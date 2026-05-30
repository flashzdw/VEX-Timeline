class IndexedDBManager {
  constructor() {
    this.dbName = 'vex-timeline';
    this.dbVersion = 3;
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
          store.createIndex('timeline_id', 'timeline_id', { unique: false });
        } else {
          const store = event.target.transaction.objectStore('records');
          if (!store.indexNames.contains('timeline_id')) {
            store.createIndex('timeline_id', 'timeline_id', { unique: false });
          }
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('operation', 'operation', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
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

  getRecordsByTimeline(timelineId) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readonly');
      const store = transaction.objectStore('records');
      const request = store.getAll();

      request.onsuccess = () => {
        const filtered = request.result.filter(r => r.timeline_id === timelineId);
        resolve(filtered);
      };

      request.onerror = () => {
        reject(new Error('获取记录失败'));
      };
    });
  }

  addToSyncQueue(operation, data) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['sync_queue'], 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const entry = { operation, data, timestamp: Date.now() };
      const request = store.add(entry);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('添加同步队列失败'));
      };
    });
  }

  getSyncQueue() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['sync_queue'], 'readonly');
      const store = transaction.objectStore('sync_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const sorted = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(sorted);
      };

      request.onerror = () => {
        reject(new Error('获取同步队列失败'));
      };
    });
  }

  removeFromSyncQueue(id) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['sync_queue'], 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('删除同步队列失败'));
      };
    });
  }

  clearSyncQueue() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['sync_queue'], 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error('清空同步队列失败'));
      };
    });
  }

  upsertRecord(record) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');

      if (record.id) {
        const getRequest = store.get(record.id);

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const updatedRecord = {
              ...getRequest.result,
              ...record,
              id: record.id,
              updatedAt: Date.now()
            };
            const putRequest = store.put(updatedRecord);
            putRequest.onsuccess = () => {
              resolve(updatedRecord);
            };
            putRequest.onerror = () => {
              reject(new Error('更新记录失败'));
            };
          } else {
            const now = Date.now();
            const newRecord = {
              ...record,
              createdAt: now,
              updatedAt: now
            };
            const addRequest = store.add(newRecord);
            addRequest.onsuccess = () => {
              newRecord.id = addRequest.result;
              resolve(newRecord);
            };
            addRequest.onerror = () => {
              reject(new Error('添加记录失败'));
            };
          }
        };

        getRequest.onerror = () => {
          reject(new Error('获取记录失败'));
        };
      } else {
        const now = Date.now();
        const newRecord = {
          ...record,
          createdAt: now,
          updatedAt: now
        };
        const addRequest = store.add(newRecord);
        addRequest.onsuccess = () => {
          newRecord.id = addRequest.result;
          resolve(newRecord);
        };
        addRequest.onerror = () => {
          reject(new Error('添加记录失败'));
        };
      }
    });
  }

  replaceRecordsForTimeline(timelineId, records) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const existing = getAllRequest.result.filter(r => r.timeline_id === timelineId);
        let deleteCount = existing.length;
        let deleted = 0;

        if (deleteCount === 0) {
          let added = 0;
          records.forEach(record => {
            const now = Date.now();
            const newRecord = {
              ...record,
              createdAt: now,
              updatedAt: now
            };
            const addRequest = store.add(newRecord);
            addRequest.onsuccess = () => {
              added++;
              if (added === records.length) {
                resolve(added);
              }
            };
            addRequest.onerror = () => {
              reject(new Error('添加记录失败'));
            };
          });
          if (records.length === 0) {
            resolve(0);
          }
          return;
        }

        existing.forEach(record => {
          const deleteRequest = store.delete(record.id);
          deleteRequest.onsuccess = () => {
            deleted++;
            if (deleted === deleteCount) {
              let added = 0;
              if (records.length === 0) {
                resolve(0);
                return;
              }
              records.forEach(record => {
                const now = Date.now();
                const newRecord = {
                  ...record,
                  createdAt: now,
                  updatedAt: now
                };
                const addRequest = store.add(newRecord);
                addRequest.onsuccess = () => {
                  added++;
                  if (added === records.length) {
                    resolve(added);
                  }
                };
                addRequest.onerror = () => {
                  reject(new Error('添加记录失败'));
                };
              });
            }
          };
          deleteRequest.onerror = () => {
            reject(new Error('删除记录失败'));
          };
        });
      };

      getAllRequest.onerror = () => {
        reject(new Error('获取记录失败'));
      };
    });
  }
}

const dbManager = new IndexedDBManager();
