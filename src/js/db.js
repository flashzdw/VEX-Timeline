class IndexedDBManager {
  constructor() {
    this.dbName = 'vex-timeline';
    this.dbVersion = 2;
    this.db = null;
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('无法打开数据库'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        } else {
          // 升级现有数据库
          const store = event.target.transaction.objectStore('records');
          // 不需要显式创建新字段，IndexedDB 自动支持
        }
      };
    });
  }

  addRecord(record) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');
      const now = Date.now();
      
      const newRecord = {
        ...record,
        createdAt: now,
        updatedAt: now
      };

      const request = store.add(newRecord);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('添加记录失败'));
      };
    });
  }

  getRecordsByDate(date) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readonly');
      const store = transaction.objectStore('records');
      const index = store.index('date');
      const request = index.getAll(date);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('获取记录失败'));
      };
    });
  }

  updateRecord(id, record) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          reject(new Error('记录不存在'));
          return;
        }

        const updatedRecord = {
          ...getRequest.result,
          ...record,
          id: id,
          updatedAt: Date.now()
        };

        const updateRequest = store.put(updatedRecord);
        
        updateRequest.onsuccess = () => {
          resolve(updatedRecord);
        };
        
        updateRequest.onerror = () => {
          reject(new Error('更新记录失败'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('获取记录失败'));
      };
    });
  }

  deleteRecord(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('删除记录失败'));
      };
    });
  }

  getAllRecords() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readonly');
      const store = transaction.objectStore('records');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('获取所有记录失败'));
      };
    });
  }

  getDatesWithRecords(year, month) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readonly');
      const store = transaction.objectStore('records');
      const request = store.openCursor();
      const dates = new Set();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const record = cursor.value;
          const [recordYear, recordMonth] = record.date.split('-');
          
          if (parseInt(recordYear) === year && parseInt(recordMonth) === month) {
            dates.add(record.date);
          }
          
          cursor.continue();
        } else {
          resolve(Array.from(dates).sort());
        }
      };

      request.onerror = () => {
        reject(new Error('获取日期列表失败'));
      };
    });
  }
}

const dbManager = new IndexedDBManager();
