'use strict';

// ============================================================================
// Message controller - secure patient-to-provider care-team messaging.
// ----------------------------------------------------------------------------
// Two surfaces share one thread model:
//   - Patient side  (/api/patient/messages*)  - a patient sees and posts to
//     their own threads only.
//   - Provider side (/api/provider/messages*) - a clinician (provider or
//     support role) sees every open thread and replies to any of them.
//
// Message bodies are PHI-adjacent clinical communication: they are encrypted
// with the PHI encryption service before they reach the database and decrypted
// only here, after an authorization check. The model never sees plaintext.
// ============================================================================

const messageModel = require('../models/message.model');
const providerModel = require('../models/provider.model');
const userModel = require('../models/user.model');
const encryptionService = require('../services/encryption.service');
const notificationService = require('../services/notification');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// The longest a single message body may be. Long enough for a detailed
// clinical note, bounded so a single row cannot be abused.
const MAX_BODY_LENGTH = 5000;

// Roles whose messages a patient reader has not yet seen.
const CLINICIAN_ROLES = ['provider', 'support'];
// Roles whose messages a clinician reader has not yet seen.
const PATIENT_ROLES = ['patient'];

// Shape a stored message row for the API: decrypt the body and drop the raw
// ciphertext and the internal sender_user_id.
function presentMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderRole: row.sender_role,
    body: encryptionService.decrypt(row.body_encrypted),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// Validate and normalize a request body's message text. Returns the trimmed
// string, or throws a 400/422 AppError.
function requireBodyText(req) {
  const raw = req.body && req.body.body;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw errors.badRequest('A Message Body Is Required.');
  }
  const text = raw.trim();
  if (text.length > MAX_BODY_LENGTH) {
    throw errors.unprocessable(
      'A Message May Not Exceed ' + MAX_BODY_LENGTH + ' Characters.'
    );
  }
  return text;
}

// -- Patient surface ---------------------------------------------------------

// GET /api/patient/messages
// The patient's threads plus their total unread count.
async function listPatientThreads(req, res, next) {
  try {
    const [threads, unreadCount] = await Promise.all([
      messageModel.findThreadsByPatient(req.user.id),
      messageModel.unreadCountForPatient(req.user.id),
    ]);
    res.status(200).json({ threads: threads, unreadCount: unreadCount });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/messages/:threadId
// One thread with its full message history. Opening a thread marks every
// clinician message in it as read.
async function getPatientThread(req, res, next) {
  try {
    const thread = await messageModel.findThreadById(req.params.threadId);
    if (!thread) {
      return next(errors.notFound('Conversation Not Found.'));
    }
    if (thread.patient_user_id !== req.user.id) {
      return next(
        errors.forbidden('You May Only Read Your Own Conversations.')
      );
    }

    await messageModel.markMessagesRead(thread.id, CLINICIAN_ROLES);
    const messages = await messageModel.findMessagesByThread(thread.id);

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'message_thread.viewed',
      entityType: 'message_thread',
      entityId: thread.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({
      thread: thread,
      messages: messages.map(presentMessage),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/messages
// The patient posts a message. Their open thread is created on first use.
async function postPatientMessage(req, res, next) {
  try {
    const text = requireBodyText(req);
    const thread = await messageModel.getOrCreateOpenThread(req.user.id);
    const message = await messageModel.addMessage({
      threadId: thread.id,
      senderUserId: req.user.id,
      senderRole: 'patient',
      bodyEncrypted: encryptionService.encrypt(text),
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'message.posted',
      entityType: 'message',
      entityId: message.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({
      thread: thread,
      message: presentMessage(message),
    });
  } catch (err) {
    next(err);
  }
}

// -- Provider surface --------------------------------------------------------

// GET /api/provider/messages
// Every open thread plus the count of unread patient messages.
async function listProviderThreads(req, res, next) {
  try {
    const [threads, unreadCount] = await Promise.all([
      messageModel.findOpenThreads(100),
      messageModel.unreadCountForClinicians(),
    ]);
    res.status(200).json({ threads: threads, unreadCount: unreadCount });
  } catch (err) {
    next(err);
  }
}

// GET /api/provider/messages/:threadId
// One thread with its full history. Opening it marks the patient's messages
// as read.
async function getProviderThread(req, res, next) {
  try {
    const thread = await messageModel.findThreadById(req.params.threadId);
    if (!thread) {
      return next(errors.notFound('Conversation Not Found.'));
    }

    await messageModel.markMessagesRead(thread.id, PATIENT_ROLES);
    const [messages, patient] = await Promise.all([
      messageModel.findMessagesByThread(thread.id),
      userModel.findById(thread.patient_user_id),
    ]);

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'message_thread.viewed',
      entityType: 'message_thread',
      entityId: thread.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({
      thread: thread,
      patient: patient
        ? { id: patient.id, firstName: patient.first_name, lastName: patient.last_name }
        : null,
      messages: messages.map(presentMessage),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/provider/messages/:threadId
// A clinician replies to a thread. The first provider to reply claims the
// thread. The patient is notified that a new message is waiting.
async function postProviderMessage(req, res, next) {
  try {
    const text = requireBodyText(req);
    const thread = await messageModel.findThreadById(req.params.threadId);
    if (!thread) {
      return next(errors.notFound('Conversation Not Found.'));
    }

    // A support-role user has no provider record; their messages are tagged
    // 'support'. A provider-role user replies as 'provider'.
    const senderRole = req.user.role === 'provider' ? 'provider' : 'support';

    const message = await messageModel.addMessage({
      threadId: thread.id,
      senderUserId: req.user.id,
      senderRole: senderRole,
      bodyEncrypted: encryptionService.encrypt(text),
    });

    // The first provider to answer claims an unassigned thread.
    let senderName = 'Your Care Team';
    if (senderRole === 'provider') {
      const provider = await providerModel.findByUserId(req.user.id);
      if (provider) {
        await messageModel.assignProviderIfUnset(thread.id, provider.id);
        senderName = provider.full_name || senderName;
      }
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'message.posted',
      entityType: 'message',
      entityId: message.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    // Notify the patient. The dedupe key is the message id, so each reply
    // notifies exactly once. Notification failure never throws.
    const patient = await userModel.findById(thread.patient_user_id);
    await notificationService.send({
      userId: thread.patient_user_id,
      template: 'new_message',
      payload: {
        firstName: patient ? patient.first_name : '',
        senderName: senderName,
      },
      dedupeKey: 'new-message:' + message.id,
    });

    res.status(201).json({
      thread: thread,
      message: presentMessage(message),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPatientThreads: listPatientThreads,
  getPatientThread: getPatientThread,
  postPatientMessage: postPatientMessage,
  listProviderThreads: listProviderThreads,
  getProviderThread: getProviderThread,
  postProviderMessage: postProviderMessage,
};
