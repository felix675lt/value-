const db = require('../config/database');

// POST /api/messages
async function sendMessage(req, res, next) {
  try {
    const { receiver_id, project_id, content } = req.body;
    const senderId = req.user.id;

    // [LOW] 자기 자신에게 메시지 차단
    if (receiver_id === senderId) {
      return res.status(400).json({ error: '자기 자신에게 메시지를 보낼 수 없습니다.' });
    }

    // 수신자 존재 확인
    const receiver = await db('users').where({ id: receiver_id }).first();
    if (!receiver) return res.status(404).json({ error: '수신자를 찾을 수 없습니다.' });

    // [HIGH] 관계 검증 — 프로젝트 기반 관계가 있는 경우에만 메시지 허용
    const hasRelation = await db('proposals')
      .where(function () {
        this.where({ expert_id: senderId }).orWhere({ expert_id: receiver_id });
      })
      .whereIn('project_id', function () {
        this.select('id').from('projects')
          .where(function () {
            this.where({ client_id: senderId }).orWhere({ client_id: receiver_id });
          });
      })
      .first();

    const hasContract = await db('contracts')
      .where(function () {
        this.where({ client_id: senderId, expert_id: receiver_id })
          .orWhere({ client_id: receiver_id, expert_id: senderId });
      })
      .first();

    if (!hasRelation && !hasContract && req.user.role !== 'admin') {
      return res.status(403).json({ error: '프로젝트 관계가 있는 사용자에게만 메시지를 보낼 수 있습니다.' });
    }

    const [message] = await db('messages')
      .insert({
        sender_id: senderId,
        receiver_id,
        project_id,
        content: String(content).slice(0, 2000), // 메시지 길이 제한
      })
      .returning('*');

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// GET /api/messages?with=userId&project_id=xxx
async function getConversation(req, res, next) {
  try {
    const { with: withUserId, project_id, page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    if (!withUserId) return res.status(400).json({ error: 'with 파라미터가 필요합니다.' });

    // [MEDIUM] Pagination 상한
    const safeLimit = Math.min(parseInt(limit) || 50, 100);

    let query = db('messages')
      .where(function () {
        this.where({ sender_id: userId, receiver_id: withUserId })
          .orWhere({ sender_id: withUserId, receiver_id: userId });
      })
      .orderBy('created_at', 'desc');

    if (project_id) query = query.where({ project_id });

    const offset = (Math.max(parseInt(page), 1) - 1) * safeLimit;
    const messages = await query.limit(safeLimit).offset(offset);

    // 읽음 처리
    await db('messages')
      .where({ sender_id: withUserId, receiver_id: userId, is_read: false })
      .update({ is_read: true });

    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
}

// GET /api/messages/threads — 대화 목록
async function getThreads(req, res, next) {
  try {
    const userId = req.user.id;

    const threads = await db.raw(`
      SELECT DISTINCT ON (other_user)
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user,
        content as last_message,
        created_at as last_message_at,
        project_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      ORDER BY other_user, created_at DESC
    `, [userId, userId, userId]);

    const unread = await db('messages')
      .select('sender_id')
      .where({ receiver_id: userId, is_read: false })
      .count('* as count')
      .groupBy('sender_id');

    const unreadMap = {};
    for (const u of unread) {
      unreadMap[u.sender_id] = parseInt(u.count);
    }

    const result = threads.rows.map((t) => ({
      ...t,
      unread_count: unreadMap[t.other_user] || 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getConversation, getThreads };
