class CloudDBManager {
  constructor() {
    this.client = null;
  }

  _getClient() {
    if (!this.client) {
      this.client = supabaseManager.getClient();
    }
    return this.client;
  }

  async addRecord(timelineId, record) {
    const client = this._getClient();
    const userId = authManager.getCurrentUserId();
    if (!userId) throw new Error('未登录');
    const { data, error } = await client
      .from('records')
      .insert({
        timeline_id: timelineId,
        user_id: userId,
        date: record.date,
        time: record.time,
        title: record.title,
        content: record.content,
        importance: record.importance,
        image_url: record.image_url
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getRecordsByTimeline(timelineId) {
    const client = this._getClient();
    const { data, error } = await client
      .from('records')
      .select('*')
      .eq('timeline_id', timelineId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getRecordsByDate(timelineId, date) {
    const client = this._getClient();
    const { data, error } = await client
      .from('records')
      .select('*')
      .eq('timeline_id', timelineId)
      .eq('date', date);
    if (error) throw error;
    return data;
  }

  async updateRecord(recordId, updates) {
    const client = this._getClient();
    const { data, error } = await client
      .from('records')
      .update(updates)
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteRecord(recordId) {
    const client = this._getClient();
    const { error } = await client
      .from('records')
      .delete()
      .eq('id', recordId);
    if (error) throw error;
    return { success: true };
  }

  async getDatesWithRecords(timelineId, year, month) {
    const client = this._getClient();
    const { data, error } = await client
      .from('records')
      .select('date')
      .eq('timeline_id', timelineId);
    if (error) throw error;
    const dates = new Set();
    data.forEach(row => {
      const parts = row.date.split('-');
      if (parseInt(parts[0]) === year && parseInt(parts[1]) === month) {
        dates.add(row.date);
      }
    });
    return Array.from(dates).sort();
  }

  async createTimeline(name, type) {
    const client = this._getClient();
    const userId = authManager.getCurrentUserId();
    if (!userId) throw new Error('未登录');
    const insertData = {
      name: name,
      type: type,
      owner_id: userId
    };
    if (type === 'team') {
      insertData.invite_code = this._generateInviteCode();
    }
    const { data, error } = await client
      .from('timelines')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTimelinesForUser() {
    const client = this._getClient();
    const userId = authManager.getCurrentUserId();
    if (!userId) return [];
    // Split into two queries (owned + joined) to avoid the PostgREST
    // limitation where embedded SELECT inside `.or(...)` is parsed as
    // a literal string rather than a subquery, producing a 400 with
    // "invalid input syntax for type uuid" and the entire select text
    // as the offending value.
    const [{ data: owned, error: ownedErr }, { data: memberships, error: memberErr }] = await Promise.all([
      client
        .from('timelines')
        .select('*')
        .eq('owner_id', userId),
      client
        .from('timeline_members')
        .select('timeline_id')
        .eq('user_id', userId),
    ]);
    if (ownedErr) throw ownedErr;
    if (memberErr) throw memberErr;

    let joined = [];
    const memberIds = [...new Set((memberships || []).map(m => m.timeline_id))];
    // Exclude ids already covered by the owned query
    const ownedIds = new Set((owned || []).map(t => t.id));
    const remainingIds = memberIds.filter(id => !ownedIds.has(id));
    if (remainingIds.length > 0) {
      const { data: rows, error: tlErr } = await client
        .from('timelines')
        .select('*')
        .in('id', remainingIds);
      if (tlErr) throw tlErr;
      joined = rows || [];
    }

    return [...(owned || []), ...joined];
  }

  async getTimelineById(timelineId) {
    const client = this._getClient();
    const { data, error } = await client
      .from('timelines')
      .select('*')
      .eq('id', timelineId)
      .single();
    if (error) throw error;
    return data;
  }

  async getTimelineMembers(timelineId) {
    const client = this._getClient();
    const { data, error } = await client
      .from('timeline_members')
      .select('*, users(username)')
      .eq('timeline_id', timelineId);
    if (error) throw error;
    return data;
  }

  async joinTimelineByInviteCode(inviteCode) {
    const client = this._getClient();
    const userId = authManager.getCurrentUserId();
    if (!userId) throw new Error('未登录');
    const { data: timeline, error: timelineError } = await client
      .from('timelines')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('type', 'team')
      .single();
    if (timelineError || !timeline) {
      throw new Error('邀请码无效');
    }
    const { data: existingMember } = await client
      .from('timeline_members')
      .select('id')
      .eq('timeline_id', timeline.id)
      .eq('user_id', userId)
      .single();
    if (existingMember) {
      throw new Error('已经是该时间轴的成员');
    }
    const { error: memberError } = await client
      .from('timeline_members')
      .insert({
        timeline_id: timeline.id,
        user_id: userId,
        role: 'member'
      });
    if (memberError) {
      if (memberError.code === '23505') {
        throw new Error('已经是该时间轴的成员');
      }
      throw memberError;
    }
    return timeline;
  }

  async regenerateInviteCode(timelineId) {
    const client = this._getClient();
    const newCode = this._generateInviteCode();
    const { error } = await client
      .from('timelines')
      .update({ invite_code: newCode })
      .eq('id', timelineId);
    if (error) throw error;
    return newCode;
  }

  async removeMember(timelineId, userId) {
    const client = this._getClient();
    const { error } = await client
      .from('timeline_members')
      .delete()
      .eq('timeline_id', timelineId)
      .eq('user_id', userId)
      .neq('role', 'owner');
    if (error) throw error;
    return { success: true };
  }

  async uploadImage(file, timelineId) {
    const client = this._getClient();
    const filePath = `${timelineId}/${Date.now()}_${file.name}`;
    const { error } = await client
      .storage
      .from('record-images')
      .upload(filePath, file);
    if (error) throw error;
    const { data } = client
      .storage
      .from('record-images')
      .getPublicUrl(filePath);
    return data.publicUrl;
  }

  async deleteImage(imageUrl) {
    const client = this._getClient();
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/record-images/');
    const filePath = pathParts[1];
    const { error } = await client
      .storage
      .from('record-images')
      .remove([filePath]);
    if (error) throw error;
    return { success: true };
  }

  async pullAllData(timelineId) {
    return await this.getRecordsByTimeline(timelineId);
  }

  async pushLocalRecords(timelineId, records) {
    const client = this._getClient();
    const userId = authManager.getCurrentUserId();
    if (!userId) throw new Error('未登录');
    const rows = records.map(record => ({
      timeline_id: timelineId,
      user_id: userId,
      date: record.date,
      time: record.time,
      title: record.title,
      content: record.content,
      importance: record.importance,
      image_url: record.image_url
    }));
    const { data, error } = await client
      .from('records')
      .upsert(rows);
    if (error) throw error;
    return rows.length;
  }

  _generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

const cloudDBManager = new CloudDBManager();
