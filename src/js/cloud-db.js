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
    const userId = authManager.getCurrentUser().id;
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
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('插入记录失败: 未返回数据');
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
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('更新记录失败: 未返回数据或无权限');
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
    const userId = authManager.getCurrentUser().id;
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
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('创建时间轴失败: 未返回数据');

    try {
      const { data: existingMember } = await client
        .from('timeline_members')
        .select('id')
        .eq('timeline_id', data.id)
        .eq('user_id', userId);
      if (!existingMember || existingMember.length === 0) {
        await client
          .from('timeline_members')
          .insert({ timeline_id: data.id, user_id: userId, role: 'owner' });
      }
    } catch (memberError) {
      console.error('添加时间轴成员失败:', memberError);
    }

    return data;
  }

  async getTimelinesForUser() {
    const client = this._getClient();
    const userId = authManager.getCurrentUser().id;
    
    // 分开查询避免复杂的子查询导致的 URL 路径问题
    // 先查自己创建的时间轴
    const { data: ownedTimelines, error: ownedError } = await client
      .from('timelines')
      .select('*')
      .eq('owner_id', userId);
    if (ownedError) throw ownedError;
    
    // 再查自己加入的时间轴
    const { data: memberTimelines, error: memberError } = await client
      .from('timeline_members')
      .select('timeline_id, role')
      .eq('user_id', userId);
    if (memberError) throw memberError;
    
    const memberTimelineIds = memberTimelines.map(m => m.timeline_id);
    let joinedTimelines = [];
    if (memberTimelineIds.length > 0) {
      const { data: joinedData, error: joinedError } = await client
        .from('timelines')
        .select('*')
        .in('id', memberTimelineIds);
      if (joinedError) throw joinedError;
      joinedTimelines = joinedData || [];
    }
    
    // 合并并去重
    const allTimelineMap = new Map();
    (ownedTimelines || []).forEach(t => allTimelineMap.set(t.id, t));
    joinedTimelines.forEach(t => allTimelineMap.set(t.id, t));
    
    return Array.from(allTimelineMap.values());
  }

  async getTimelineById(timelineId) {
    const client = this._getClient();
    const { data, error } = await client
      .from('timelines')
      .select('*')
      .eq('id', timelineId)
      .maybeSingle();
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
    const userId = authManager.getCurrentUser().id;
    const { data: timeline, error: timelineError } = await client
      .from('timelines')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('type', 'team')
      .maybeSingle();
    if (timelineError) {
      throw new Error('邀请码无效');
    }
    if (!timeline) {
      throw new Error('邀请码无效');
    }
    // 先检查是否已加入
    const { data: existingMembers, error: checkError } = await client
      .from('timeline_members')
      .select('id')
      .eq('timeline_id', timeline.id)
      .eq('user_id', userId);
    if (checkError) {
      throw checkError;
    }
    if (existingMembers && existingMembers.length > 0) {
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
    const userId = authManager.getCurrentUser().id;
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
