class App {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'timeline';
    this.records = [];
    this.editingRecord = null;
    this.currentFilter = 'all';
    this.tempImageData = null;
    
    this.init();
  }

  async init() {
    await dbManager.initDB();
    await this.addSampleData();
    this.bindEvents();
    this.renderDate();
    await this.renderView();
  }

  async addSampleData() {
    const existingRecords = await dbManager.getAllRecords();
    if (existingRecords.length > 0) return;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const sampleRecords = [
      {
        date: this.formatDate(today),
        time: '09:30',
        importance: 'high',
        title: "调试机器人传感器",
        content: "调整了红外传感器的灵敏度，现在可以更准确地检测障碍物"
      },
      {
        date: this.formatDate(today),
        time: '14:00',
        importance: 'medium',
        title: "团队会议",
        content: "讨论了比赛策略，确定了主攻方向"
      },
      {
        date: this.formatDate(yesterday),
        time: '10:00',
        importance: 'high',
        title: "机械结构优化",
        content: "重新设计了机械臂的结构，重量减轻了15%"
      },
      {
        date: this.formatDate(yesterday),
        time: '16:00',
        importance: 'low',
        title: "编程练习",
        content: "完成了自动导航程序的编写"
      },
      {
        date: this.formatDate(twoDaysAgo),
        time: '11:00',
        importance: 'medium',
        title: "采购零件",
        content: "购买了新的电机和电池组件"
      }
    ];

    for (const record of sampleRecords) {
      await dbManager.addRecord(record);
    }
  }

  bindEvents() {
    document.getElementById('prev-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderDate();
      this.renderView();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderDate();
      this.renderView();
    });

    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentView = e.target.dataset.view;
        this.renderDate();
        this.renderView();
      });
    });

    document.getElementById('add-btn').addEventListener('click', () => {
      this.openModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveRecord();
    });

    document.getElementById('record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecord();
    });

    document.getElementById('record-modal').addEventListener('click', (e) => {
      if (e.target.id === 'record-modal') {
        this.closeModal();
      }
    });

    // 重要性选择器事件
    document.querySelectorAll('.importance-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // 图片上传事件
    document.getElementById('record-image').addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    // 移除图片事件
    document.getElementById('remove-image-btn').addEventListener('click', () => {
      this.removeImage();
    });

    // 筛选按钮事件
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.renderTimeline();
      });
    });

    // 关闭日期记录模态框
    document.getElementById('close-day-records').addEventListener('click', () => {
      this.closeDayRecords();
    });

    document.getElementById('day-records-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'day-records-overlay') {
        this.closeDayRecords();
      }
    });
  }

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      this.tempImageData = event.target.result;
      const preview = document.getElementById('image-preview');
      const previewImg = document.getElementById('preview-img');
      previewImg.src = this.tempImageData;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.tempImageData = null;
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');
    preview.style.display = 'none';
    previewImg.src = '';
    imageInput.value = '';
  }

  openModal(record = null) {
    this.editingRecord = record;
    this.tempImageData = null;
    const modal = document.getElementById('record-modal');
    const modalTitle = document.getElementById('modal-title');
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    const importanceBtns = document.querySelectorAll('.importance-btn');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');

    if (record) {
      modalTitle.textContent = '编辑记录';
      dateInput.value = record.date;
      timeInput.value = record.time || '';
      titleInput.value = record.title;
      contentInput.value = record.content || '';
      
      // 设置重要性
      importanceBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.importance === record.importance) {
          btn.classList.add('active');
        }
      });
      
      // 设置图片
      if (record.image) {
        this.tempImageData = record.image;
        previewImg.src = record.image;
        imagePreview.style.display = 'block';
      } else {
        imagePreview.style.display = 'none';
        previewImg.src = '';
      }
    } else {
      modalTitle.textContent = '添加记录';
      dateInput.value = this.formatDate(new Date());
      timeInput.value = this.formatTime(new Date());
      titleInput.value = '';
      contentInput.value = '';
      
      // 重置重要性
      importanceBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.importance === 'medium') {
          btn.classList.add('active');
        }
      });
      
      // 重置图片
      imagePreview.style.display = 'none';
      previewImg.src = '';
      this.tempImageData = null;
    }
    
    imageInput.value = '';
    modal.classList.add('active');
    titleInput.focus();
  }

  closeModal() {
    this.editingRecord = null;
    this.tempImageData = null;
    const modal = document.getElementById('record-modal');
    modal.classList.remove('active');
  }

  async saveRecord() {
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    const activeImportanceBtn = document.querySelector('.importance-btn.active');
    
    const date = dateInput.value;
    const time = timeInput.value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const importance = activeImportanceBtn.dataset.importance;
    const image = this.tempImageData;

    if (!title) {
      alert('请输入标题');
      return;
    }

    if (!date) {
      alert('请选择日期');
      return;
    }

    if (this.editingRecord) {
      await dbManager.updateRecord(this.editingRecord.id, {
        date,
        time,
        title,
        content,
        importance,
        image
      });
    } else {
      await dbManager.addRecord({
        date,
        time,
        title,
        content,
        importance,
        image
      });
    }

    this.closeModal();
    await this.renderView();
  }

  async deleteRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    await dbManager.deleteRecord(id);
    await this.renderView();
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateLabel(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    return `${year}年 ${monthName}`;
  }

  formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayName = days[date.getDay()];
    return `${year}年${month}月${day}日 ${dayName}`;
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  renderDate() {
    const dateLabel = document.getElementById('date-label');
    dateLabel.textContent = this.formatDateLabel(this.currentDate);
  }

  async renderView() {
    const timelineContainer = document.getElementById('timeline-container');
    const calendarContainer = document.getElementById('calendar-container');
    const addBtn = document.getElementById('add-btn');

    if (this.currentView === 'month') {
      timelineContainer.style.display = 'none';
      calendarContainer.style.display = 'block';
      addBtn.style.display = 'flex';
      await this.renderCalendar();
    } else {
      timelineContainer.style.display = 'block';
      calendarContainer.style.display = 'none';
      addBtn.style.display = 'flex';
      await this.renderTimeline();
    }
  }

  async renderCalendar() {
    const calendar = document.getElementById('calendar');
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const datesWithRecords = await dbManager.getDatesWithRecords(year, month + 1);
    const datesSet = new Set(datesWithRecords);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = lastDay.getDate();
    const lastDateOfPrevMonth = prevLastDay.getDate();
    
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    
    let calendarHTML = `
      <div class="calendar-header">
        ${days.map(day => `<div class="calendar-header-cell">${day}</div>`).join('')}
      </div>
      <div class="calendar-grid">
    `;
    
    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = lastDateOfPrevMonth - i;
      calendarHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }
    
    // Current month days
    for (let day = 1; day <= lastDateOfMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasRecords = datesSet.has(dateStr);
      const cellClass = hasRecords ? 'calendar-cell has-records' : 'calendar-cell';
      
      calendarHTML += `
        <div class="${cellClass}" data-date="${dateStr}">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }
    
    // Next month days
    const totalCells = firstDayOfWeek + lastDateOfMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      calendarHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }
    
    calendarHTML += `</div>`;
    calendar.innerHTML = calendarHTML;
    
    // Add click event to date cells
    document.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const dateStr = e.currentTarget.dataset.date;
        this.showDayRecords(dateStr);
      });
    });
  }

  async showDayRecords(dateStr) {
    const overlay = document.getElementById('day-records-overlay');
    const title = document.getElementById('day-records-title');
    const content = document.getElementById('day-records-content');
    
    title.textContent = this.formatDateDisplay(dateStr);
    
    const allRecords = await dbManager.getAllRecords();
    const dayRecords = allRecords.filter(r => r.date === dateStr);
    
    if (dayRecords.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          暂无记录
        </div>
      `;
    } else {
      let html = '';
      dayRecords.sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA);
      });
      
      dayRecords.forEach(record => {
        const time = record.time || '';
        const importance = record.importance || 'medium';
        
        html += `
          <div class="day-record-card">
            <div class="day-record-importance" data-importance="${importance}"></div>
            <div class="day-record-time">${time}</div>
            <div class="day-record-title">${record.title}</div>
            ${record.content ? `<div class="day-record-content">${record.content}</div>` : ''}
            ${record.image ? `
              <div class="day-record-image">
                <img src="${record.image}" alt="记录图片">
              </div>
            ` : ''}
          </div>
        `;
      });
      
      content.innerHTML = html;
    }
    
    overlay.classList.add('active');
  }

  closeDayRecords() {
    const overlay = document.getElementById('day-records-overlay');
    overlay.classList.remove('active');
  }

  showLoadingState() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = `
      <div class="loading-state">
        加载中...
      </div>
    `;
  }

  async renderTimeline() {
    const timeline = document.getElementById('timeline');
    
    this.showLoadingState();
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    this.records = await dbManager.getAllRecords();
    
    // 筛选记录
    let filteredRecords = this.records;
    if (this.currentFilter !== 'all') {
      filteredRecords = this.records.filter(r => r.importance === this.currentFilter);
    }

    if (filteredRecords.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          暂无记录
        </div>
      `;
      return;
    }

    // Group records by date
    const groupedRecords = {};
    filteredRecords.forEach(record => {
      if (!groupedRecords[record.date]) {
        groupedRecords[record.date] = [];
      }
      groupedRecords[record.date].push(record);
    });

    // Sort dates in descending order
    const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

    let timelineHTML = '';
    sortedDates.forEach(dateStr => {
      const dateRecords = groupedRecords[dateStr];
      dateRecords.sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA);
      });

      timelineHTML += `
        <div class="date-group">
          <div class="date-header">
            <span class="date-title">${this.formatDateDisplay(dateStr)}</span>
            <span class="date-count">${dateRecords.length}条</span>
          </div>
          <div class="date-records">
      `;

      dateRecords.forEach(record => {
        const time = record.time || this.formatTime(new Date(record.createdAt));
        const importance = record.importance || 'medium';
        
        timelineHTML += `
          <div class="timeline-item" data-importance="${importance}">
            <div class="timeline-card">
              <div class="timeline-card-actions">
                <button class="action-btn edit-btn" data-id="${record.id}" title="编辑">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="action-btn delete delete-btn" data-id="${record.id}" title="删除">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
              <div class="timeline-time">${time}</div>
              <div class="timeline-title">${record.title}</div>
              ${record.content ? `<div class="timeline-content">${record.content}</div>` : ''}
              ${record.image ? `
                <div class="timeline-image">
                  <img src="${record.image}" alt="记录图片">
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      timelineHTML += `
          </div>
        </div>
      `;
    });

    timeline.innerHTML = timelineHTML;

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        const record = this.records.find(r => r.id === id);
        if (record) {
          this.openModal(record);
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        this.deleteRecord(id);
      });
    });
  }
}

const app = new App();
