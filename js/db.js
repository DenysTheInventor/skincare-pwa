let db;

const DB_NAME = 'SkincareAppDB';
const DB_VERSION = 5;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('categories')) database.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
            if (!database.objectStoreNames.contains('products')) database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
            if (!database.objectStoreNames.contains('calendar')) {
                const calendarStore = database.createObjectStore('calendar', { keyPath: 'id', autoIncrement: true });
                calendarStore.createIndex('date', 'date', { unique: false });
            }
            if (!database.objectStoreNames.contains('procedureSets')) database.createObjectStore('procedureSets', { keyPath: 'id', autoIncrement: true });
            if (!database.objectStoreNames.contains('skinSurveys')) database.createObjectStore('skinSurveys', { keyPath: 'date' });
            if (!database.objectStoreNames.contains('userProfile')) database.createObjectStore('userProfile', { keyPath: 'id' });
        };
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };
        request.onerror = (event) => reject('Помилка бази даних: ' + event.target.error);
        request.onblocked = () => alert("Оновлення бази даних заблоковано. Закрийте інші вкладки з цим додатком.");
    });
}

function performTransaction(storeName, mode, action) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("База даних не ініціалізована.");
        try {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = action(store);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        } catch (error) { reject(error); }
    });
}

// Категорії
export function addCategory(data) { return performTransaction('categories', 'readwrite', store => store.add(data)); }
export function getAllCategories() { return performTransaction('categories', 'readonly', store => store.getAll()); }
export function deleteCategory(id) { return performTransaction('categories', 'readwrite', store => store.delete(id)); }

// Продукти
export function addProduct(data) { return performTransaction('products', 'readwrite', store => store.add(data)); }
export function getAllProducts() { return performTransaction('products', 'readonly', store => store.getAll()); }
export function deleteProduct(id) { return performTransaction('products', 'readwrite', store => store.delete(id)); }
export function updateProduct(data) { return performTransaction('products', 'readwrite', store => store.put(data)); }
export function getProductById(id) { return performTransaction('products', 'readonly', store => store.get(id)); }

// Календар
export function addCalendarEntry(data) { return performTransaction('calendar', 'readwrite', store => store.add(data)); }
export function getAllCalendarEntries() { return performTransaction('calendar', 'readonly', store => store.getAll()); }
export function deleteCalendarEntry(id) { return performTransaction('calendar', 'readwrite', store => store.delete(id)); }
export function getCalendarEntriesForMonth(year, month) {
    return performTransaction('calendar', 'readonly', (store) => {
        const index = store.index('date');
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return index.getAll(IDBKeyRange.bound(startDate, endDate));
    });
}

// Сети процедур
export function addSet(data) { return performTransaction('procedureSets', 'readwrite', store => store.add(data)); }
export function getAllSets() { return performTransaction('procedureSets', 'readonly', store => store.getAll()); }
export function deleteSet(id) { return performTransaction('procedureSets', 'readwrite', store => store.delete(id)); }
export function updateSet(data) { return performTransaction('procedureSets', 'readwrite', store => store.put(data)); }
export function getSetById(id) { return performTransaction('procedureSets', 'readonly', store => store.get(id)); }

// Опитування про шкіру
export function addSkinSurvey(data) { return performTransaction('skinSurveys', 'readwrite', store => store.add(data)); }
export function getSkinSurveyByDate(date) { return performTransaction('skinSurveys', 'readonly', store => store.get(date)); }

// Профіль користувача
export function updateProfile(profile) { profile.id = 1; return performTransaction('userProfile', 'readwrite', store => store.put(profile)); }
export function getProfile() { return performTransaction('userProfile', 'readonly', store => store.get(1)); }