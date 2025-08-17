import {
    initDB, getAllCategories, addCategory, deleteCategory,
    getAllProducts, addProduct, deleteProduct, updateProduct, getProductById,
    getCalendarEntriesForMonth, addCalendarEntry, deleteCalendarEntry, getAllCalendarEntries,
    addSet, getAllSets, deleteSet, getSetById, updateSet,
    addSkinSurvey, getSkinSurveyByDate, getAllSurveys,
    updateProfile, getProfile, importData
} from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
    // ---- Глобальний стан додатку ----
    const state = {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(),
        selectedDate: null,
        history: { fullData: [], filters: { categories: [], colors: [], dateFrom: '', dateTo: '' } },
        navigationStack: [] // Стек для кнопки "Назад"
    };

    // ---- Іконки ----
    const ICONS = {
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        product: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4z"></path><path d="M16 13V7c0-2.8-2.2-5-5-5S6 4.2 6 7v6"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };

    let skinStateChart = null;
    
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    
    const modalOverlay = $('#modal-overlay');
    
    const showModal = (modalElement) => {
        modalOverlay.classList.add('visible');
        modalElement.classList.add('visible');
    };
    
    const hideModal = (modalElement) => {
        modalOverlay.classList.remove('visible');
        modalElement.classList.remove('visible');
    };

    try {
        await initDB();
        await renderAll();
        initEventListeners();
        navigateToPage($('#home-view'));
        updateWeather();
    } catch (error) { console.error('Не вдалося ініціалізувати додаток:', error); }

    function initEventListeners() {
        // --- НОВІ СЛУХАЧІ для Імпорту/Експорту ---
        const importFileInput = $('#import-file-input');
        const importDataBtn = $('#import-data-btn');
        const exportDataBtn = $('#export-data-btn');

        if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
        if (importFileInput) importFileInput.addEventListener('change', () => {
                const file = importFileInput.files[0];
                if (file) {
                    $('#import-file-name').textContent = file.name;
                    importDataBtn.disabled = false;
                } else {
                    $('#import-file-name').textContent = 'Файл не вибрано';
                    importDataBtn.disabled = true;
                }
            });
        if (importDataBtn) importDataBtn.addEventListener('click', handleImportData);

        $$('#bottom-nav .nav-btn').forEach(button => button.addEventListener('click', () => {
            const targetPage = $(`#${button.dataset.target}`);
            navigateToPage(targetPage);
        }));

        $('#hard-refresh-btn').addEventListener('click', handleHardRefresh);

        $$('.settings-card').forEach(card => card.addEventListener('click', () => {
            const targetPage = $(`#${card.dataset.target}`);
            navigateToPage(targetPage, $('#settings-view'));
        }));
        
        $('#header-back-btn').addEventListener('click', () => {
            if (state.navigationStack.length > 1) {
                state.navigationStack.pop();
                const previousPage = state.navigationStack[state.navigationStack.length - 1];
                navigateToPage(previousPage, null, true);
            }
        });

        $('#add-product-btn').addEventListener('click', () => { openProductModal(); showModal($('#product-modal')); });
        $('#close-modal-btn').addEventListener('click', () => hideModal($('#product-modal')));
        $('#add-set-btn').addEventListener('click', () => { openSetModal(); showModal($('#set-modal')); });
        $('#close-set-modal-btn').addEventListener('click', () => hideModal($('#set-modal')));
        $('#add-procedure-btn').addEventListener('click', () => { handleOpenProcedureModal(); showModal($('#procedure-modal')); });
        $('#central-fab-btn').addEventListener('click', () => { handleOpenProcedureModal(); showModal($('#procedure-modal')); });
        $('#close-procedure-modal-btn').addEventListener('click', () => hideModal($('#procedure-modal')));
        $('#apply-set-btn').addEventListener('click', () => { handleOpenSelectSetModal(); showModal($('#select-set-modal')); });
        $('#close-select-set-modal-btn').addEventListener('click', () => hideModal($('#select-set-modal')));
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                $$('.modal.visible').forEach(m => hideModal(m));
            }
        });

        const filterModal = $('#filter-modal-overlay');
        if (filterModal) {
            $('#open-filter-btn').addEventListener('click', () => filterModal.classList.add('visible'));
            $('#close-filter-btn').addEventListener('click', () => filterModal.classList.remove('visible'));
            filterModal.addEventListener('click', (e) => { if (e.target.id === 'filter-modal-overlay') filterModal.classList.remove('visible'); });
        }
        
        $('#product-form').addEventListener('submit', handleProductFormSubmit);
        $('#products-list').addEventListener('click', handleListClick);
        $('#add-category-form').addEventListener('submit', handleCategoryFormSubmit);
        $('#categories-list').addEventListener('click', handleListClick);
        $('#set-form').addEventListener('submit', handleSetFormSubmit);
        $('#sets-list').addEventListener('click', handleListClick);
        $('#prev-month-btn').addEventListener('click', async () => { state.currentMonth--; if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; } await renderCalendar(); });
        $('#next-month-btn').addEventListener('click', async () => { state.currentMonth++; if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; } await renderCalendar(); });
        $('#calendar-grid').addEventListener('click', async (e) => { if (e.target.matches('.calendar-day') && e.target.dataset.date) { state.selectedDate = e.target.dataset.date; $('#day-actions-container').style.display = 'flex'; await renderCalendar(); } });
        $('#day-details-content').addEventListener('click', handleListClick);
        $('#procedure-form').addEventListener('submit', handleProcedureFormSubmit);
        $('#select-set-form').addEventListener('submit', handleApplySet);
        $('#apply-filters-btn').addEventListener('click', handleApplyFilters);
        $('#reset-filters-btn').addEventListener('click', handleResetFilters);
        $('#skin-survey-card').addEventListener('click', handleMoodSurveyClick);
        $('#profile-form').addEventListener('submit', handleProfileFormSubmit);
        $('#profile-photo').addEventListener('change', handleProfilePhotoChange);
        $('.settings-card[data-target="profile-page"]').addEventListener('click', loadProfileData);
    }
    
    async function navigateToPage(pageElement, parentPage = null, isBack = false) {
        if (!pageElement) return;

        if (!isBack) {
            if (pageElement.classList.contains('sub-page')) {
                if (state.navigationStack[state.navigationStack.length - 1] !== pageElement) {
                    state.navigationStack.push(pageElement);
                }
            } else {
                state.navigationStack = [pageElement];
            }
        }
        
        if (pageElement.classList.contains('sub-page')) {
            pageElement.classList.add('visible');
        } else {
            $$('.page:not(.sub-page)').forEach(p => p.classList.remove('active'));
            pageElement.classList.add('active');
            $$('.sub-page.visible').forEach(p => p.classList.remove('visible'));

            $$('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.target === pageElement.id);
            });
        }
        await updateHeader();
    }

    async function updateHeader() {
        const activePage = state.navigationStack[state.navigationStack.length - 1] || $('.page.active');
        if (!activePage) return;
        
        const title = activePage.dataset.title || '';
        const type = activePage.dataset.type || 'secondary';

        const profile = await getProfile() || {};
        const userName = profile.name || 'User';
        const userAvatarHtml = profile.photo 
            ? `<img src="${profile.photo}" alt="User Avatar">`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        const headerTitle = $('#header-title'), headerGreeting = $('#header-greeting'), avatarLeft = $('#header-avatar-left'), avatarRight = $('#header-avatar-right'), backBtn = $('#header-back-btn');
        
        headerTitle.textContent = ''; headerGreeting.textContent = ''; avatarLeft.innerHTML = ''; avatarRight.innerHTML = '';
        [backBtn, avatarLeft, avatarRight].forEach(el => el.classList.add('hidden'));

        if (type === 'main') {
            const hour = new Date().getHours();
            let greeting = "Доброго ранку";
            if (hour >= 12 && hour < 17) greeting = "Доброго дня";
            else if (hour >= 17) greeting = "Доброго вечора";
            headerGreeting.textContent = `${greeting}, ${userName}`;
            avatarLeft.innerHTML = userAvatarHtml;
            avatarLeft.classList.remove('hidden');
        } else {
            headerTitle.textContent = title;
            avatarRight.innerHTML = userAvatarHtml;
            avatarRight.classList.remove('hidden');
            if (state.navigationStack.length > 1) {
                backBtn.classList.remove('hidden');
            }
        }
    }
    
    async function handleListClick(e) {
        const delCatBtn = e.target.closest('.delete-cat-btn'), delProdBtn = e.target.closest('.delete-prod-btn'), editProdBtn = e.target.closest('.edit-prod-btn'), delEntryBtn = e.target.closest('.delete-entry-btn'), delSetBtn = e.target.closest('.delete-set-btn'), editSetBtn = e.target.closest('.edit-set-btn');
        if (delCatBtn) if (confirm('Видалити категорію?')) { await deleteCategory(Number(delCatBtn.dataset.id)); await renderAll(); }
        if (delProdBtn) if (confirm('Видалити продукт?')) { await deleteProduct(Number(delProdBtn.dataset.id)); await renderAll(); }
        if (editProdBtn) { const product = await getProductById(Number(editProdBtn.dataset.id)); if (product) { openProductModal(product); showModal($('#product-modal')); } }
        if (delEntryBtn) if (confirm('Видалити процедуру?')) { await deleteCalendarEntry(Number(delEntryBtn.dataset.id)); await renderAll(); }
        if (delSetBtn) if (confirm('Видалити сет?')) { await deleteSet(Number(delSetBtn.dataset.id)); await renderSets(); }
        if (editSetBtn) { const set = await getSetById(Number(editSetBtn.dataset.id)); if (set) { openSetModal(set); showModal($('#set-modal')); } }
    }

    async function renderAll() { await Promise.all([renderHomePage(), renderCategories(), renderProducts(), renderCalendar(), renderHistory(), renderSets(), renderAnalyticsChart()]); }

    async function renderHomePage() {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const entries = await getCalendarEntriesForMonth(now.getFullYear(), now.getMonth());
        if (entries.some(e => e.date === todayStr)) {
            $('#care-status-text').textContent = 'Внесено';
            $('#care-status-icon').textContent = '✅';
        } else {
            $('#care-status-icon').textContent = '⚪️';
            $('#care-status-text').textContent = 'Не внесено';
        }
        const surveyResult = await getSkinSurveyByDate(todayStr);
        if (surveyResult) {
            // Якщо результат є, ховаємо опитування і показуємо результат в картці догляду
            $('#skin-survey-card').classList.add('hidden');
            showSurveyResult(surveyResult.mood); 
        } else {
            // Якщо результату немає, показуємо опитування і ховаємо результат
            $('#skin-survey-card').classList.remove('hidden');
            $('#skin-assessment-content').classList.add('hidden');
        }
    }

    async function renderAnalyticsChart() {
    const surveys = await getAllSurveys();
    const ctx = document.getElementById('skin-state-chart');

    // Перевіряємо, чи є canvas на сторінці
    if (!ctx) return;

    // 1. Готуємо дані за останні 7 днів
    const labels = [];
    const dataPoints = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        const dateString = date.toISOString().split('T')[0];
        const dayLabel = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
        labels.push(dayLabel);
        
        const surveyForDay = surveys.find(s => s.date === dateString);
        dataPoints.push(surveyForDay ? surveyForDay.mood : null);
    }
    
    // 2. Налаштовуємо графік
    if (skinStateChart) {
        skinStateChart.destroy();
    }

    skinStateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Стан шкіри',
                data: dataPoints,
                borderColor: 'rgba(79, 195, 247, 1)',
                backgroundColor: 'rgba(79, 195, 247, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(79, 195, 247, 1)',
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.4,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0, // Явно вказуємо мінімум
                    max: 6, // Встановлюємо максимум на 6
                    ticks: {
                        stepSize: 1,
                        padding: 10,
                        callback: function(value) {
                            const emojiMap = { 5:'😀', 4:'🙂', 3:'😐', 2:'😕', 1:'😣' };
                            return emojiMap[value] || '';
                        }
                    },
                    grid: {
                        drawOnChartArea: true,
                        color: function(context) {
                            if (context.tick.value === 6) {
                                return 'transparent'; // Робимо верхню лінію сітки прозорою
                            }
                            return '#e0e0e0'; // Колір інших ліній
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            if (value === null) return 'Немає даних';
                            const textMap = { 5:'Чудово', 4:'Добре', 3:'Нормально', 2:'Не дуже', 1:'Погано' };
                            return `Оцінка: ${textMap[value]}`;
                        }
                    }
                }
            }
        }
    });
}

    async function renderCategories() {
        const list = $('#categories-list');
        const data = await getAllCategories();
        list.innerHTML = data.length ? data.map(c => `<div class="card"><div class="card-content">${c.name}</div><div class="card-actions"><button class="delete-btn delete-cat-btn" data-id="${c.id}">${ICONS.trash}</button></div></div>`).join('') : '<p>Категорій ще немає.</p>';
    }

    async function renderProducts() {
        const list = $('#products-list');
        const data = await getAllProducts();
        list.innerHTML = data.length ? data.map(p => {
            const image = p.image ? `<img src="${p.image}" alt="${p.name}">` : `<div class="product-icon-placeholder" style="background-color: ${p.color || '#ccc'};">${ICONS.product}</div>`;
            return `<div class="product-card">${image}<div class="product-details"><h3>${p.name}</h3><p>${p.description || ''}</p></div><div class="card-actions"><button class="edit-btn edit-prod-btn" data-id="${p.id}">${ICONS.edit}</button><button class="delete-btn delete-prod-btn" data-id="${p.id}">${ICONS.trash}</button></div></div>`;
        }).join('') : '<p>Продуктів ще немає.</p>';
    }

    async function renderSets() {
        const list = $('#sets-list');
        const [sets, categories] = await Promise.all([getAllSets(), getAllCategories()]);
        list.innerHTML = sets.length ? sets.map(s => {
            const category = categories.find(c => c.id === s.categoryId);
            return `<div class="card"><div class="card-content"><strong>${s.name}</strong><small style="color:#757575; display:block;">(${category?.name || '?'}, ${s.productIds.length} пр.)</small></div><div class="card-actions"><button class="edit-btn edit-set-btn" data-id="${s.id}">${ICONS.edit}</button><button class="delete-btn delete-set-btn" data-id="${s.id}">${ICONS.trash}</button></div></div>`;
        }).join('') : '<p>Сетів ще немає.</p>';
    }

    async function renderCalendar() {
        if (!$('#calendar-grid')) return;
        const grid = $('#calendar-grid');
        grid.innerHTML = '';
        const monthNames = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
        $('#calendar-header').textContent = `${monthNames[state.currentMonth]} ${state.currentYear}`;
        const entries = await getCalendarEntriesForMonth(state.currentYear, state.currentMonth);
        const datesWithEntries = new Set(entries.map(e => e.date));
        const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
        const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
        grid.innerHTML += '<div></div>'.repeat((firstDay === 0) ? 6 : firstDay - 1);
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const today = new Date();
            const isToday = day === today.getDate() && state.currentMonth === today.getMonth() && state.currentYear === today.getFullYear();
            grid.innerHTML += `<div class="calendar-day ${isToday ? 'today' : ''} ${dateStr === state.selectedDate ? 'selected' : ''}" data-date="${dateStr}">${day}${datesWithEntries.has(dateStr) ? '<div class="event-dot"></div>' : ''}</div>`;
        }
        await renderDayDetails();
    }

    async function renderDayDetails() {
        const content = $('#day-details-content');
        if (!$('#day-details-header')) return;
        if (!state.selectedDate) { $('#day-details-header').textContent = 'Виберіть день'; content.innerHTML = ''; $('#day-actions-container').style.display = 'none'; return; }
        const dateObj = new Date(state.selectedDate);
        $('#day-details-header').textContent = `Процедури за ${dateObj.toLocaleDateString('uk-UA', {day:'numeric',month:'long'})}`;
        const dayEntries = (await getCalendarEntriesForMonth(dateObj.getFullYear(),dateObj.getMonth())).filter(e => e.date === state.selectedDate);
        content.innerHTML = '';
        if (dayEntries.length === 0) { content.innerHTML = '<p>На цей день процедур не заплановано.</p>'; return; }
        const [products, categories] = await Promise.all([getAllProducts(), getAllCategories()]);
        const grouped = dayEntries.reduce((acc, entry) => { (acc[entry.categoryId] = acc[entry.categoryId] || []).push(entry); return acc; }, {});
        Object.keys(grouped).sort((a,b)=>a-b).forEach(catId => {
            const category = categories.find(c => c.id === Number(catId));
            content.innerHTML += `<h3 class="procedure-group-header">${category?.name || 'Без категорії'}</h3>`;
            grouped[catId].sort((a, b) => a.time.localeCompare(b.time)).forEach(entry => {
                const product = products.find(p => p.id === entry.productId);
                content.innerHTML += `<div class="procedure-entry"><div class="procedure-info"><span class="time">${entry.time}</span><span class="product-name">${product?.name || '?'}</span><span class="category-name" style="opacity:0.7">${entry.notes||''}</span></div><div class="card-actions"><button class="delete-btn delete-entry-btn" data-id="${entry.id}">${ICONS.trash}</button></div></div>`;
            });
        });
    }

    async function handleExportData() {
        try {
            const [categories, products, calendar, sets, profile, surveys] = await Promise.all([
                getAllCategories(), getAllProducts(), getAllCalendarEntries(),
                getAllSets(), getProfile(), getAllSurveys()
            ]);

            const allData = { categories, products, calendar, procedureSets: sets, userProfile: profile, skinSurveys: surveys };
            
            const jsonString = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `skincare_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Ошибка при экспорте данных:', error);
            alert('Не вдалося експортувати дані.');
        }
    }

    async function handleImportData() {
        const file = $('#import-file-input').files[0];
        if (!file) {
            alert('Будь ласка, виберіть файл.');
            return;
        }

        const confirmed = confirm("Увага! Всі поточні дані будуть видалені і замінені даними з файлу. Продовжити?");
        if (!confirmed) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // Тут можна додати перевірку на коректність структури файлу
                await importData(data);
                alert('Дані успішно імпортовано! Додаток буде перезавантажено.');
                location.reload(); // Перезавантажуємо сторінку, щоб побачити зміни
            } catch (error) {
                console.error('Помилка при імпорті:', error);
                alert('Не вдалося імпортувати дані. Перевірте, чи файл не пошкоджено.');
            }
        };
        reader.onerror = () => {
            alert('Не вдалося прочитати файл.');
        };
        reader.readAsText(file);
    }

    async function renderHistory() {
        if (!$('#history-list')) return;
        const [entries, products, categories] = await Promise.all([getAllCalendarEntries(), getAllProducts(), getAllCategories()]);
        state.history.fullData = entries.map(entry => ({...entry, productName:products.find(p=>p.id===entry.productId)?.name||'?', categoryName:categories.find(c=>c.id===entry.categoryId)?.name||'?', color:products.find(p=>p.id===entry.productId)?.color||'#fff'})).sort((a,b)=>new Date(b.date)-new Date(a.date));
        populateFilterModal(categories, products);
        displayHistoryList();
    }

    function displayHistoryList() {
        let data = state.history.fullData;
        const { categories, colors, dateFrom, dateTo } = state.history.filters;
        if (categories.length) data = data.filter(d => categories.includes(String(d.categoryId)));
        if (colors.length) data = data.filter(d => colors.includes(d.color));
        if (dateFrom) data = data.filter(d => d.date >= dateFrom);
        if (dateTo) data = data.filter(d => d.date <= dateTo);
        const list = $('#history-list');
        list.innerHTML = data.length ? data.map(d => `<div class="history-card"><div class="history-card-details"><span class="product-name">${d.productName}</span><span class="category-name">${d.categoryName}</span></div><div class="history-card-date">${new Date(d.date).toLocaleDateString('uk-UA',{day:'2-digit',month:'short'})}</div></div>`).join('') : `<p style="text-align:center; padding: 20px;">Записів не знайдено.</p>`;
    }

    function populateFilterModal(categories, products) {
        const catList=$('#filter-categories-list'), colorList=$('#filter-colors-list');
        if (!catList || !colorList) return;
        catList.innerHTML = [...new Map(categories.map(c=>[c.id,c])).values()].map(c=>`<label class="custom-checkbox"><input type="checkbox" value="${c.id}" ${state.history.filters.categories.includes(String(c.id))?'checked':''}><span class="checkmark">${ICONS.check}</span><span>${c.name}</span></label>`).join('');
        colorList.innerHTML = [...new Set(products.map(p=>p.color).filter(Boolean))].map(color=>`<label class="custom-checkbox"><input type="checkbox" value="${color}" ${state.history.filters.colors.includes(color)?'checked':''}><span class="checkmark" style="background-color:${color};border-color:${color};">${ICONS.check}</span><span style="display:none;">${color}</span></label>`).join('');
    }

    async function handleCategoryFormSubmit(e) { e.preventDefault(); const input = $('#category-name-input'); if(input.value.trim()){ await addCategory({name:input.value.trim()}); input.value = ''; await renderAll();} }
    
    async function handleProductFormSubmit(e) { 
        e.preventDefault(); 
        let imageBase64 = $('#product-image').files[0] ? await new Promise(r=>{const reader=new FileReader();reader.onload=e=>r(e.target.result);reader.readAsDataURL($('#product-image').files[0])}) : null; 
        const id = Number($('#product-id').value); 
        const data={name:$('#product-name').value,description:$('#product-description').value,notes:$('#product-notes').value,color:$('#product-color').value}; 
        if(id){const existing=await getProductById(id);data.id=id;data.image=imageBase64||existing.image;await updateProduct(data)}
        else{data.image=imageBase64;await addProduct(data)} 
        $('#product-form').reset(); 
        hideModal($('#product-modal'));
        await renderAll(); 
    }

    function openProductModal(p=null) { 
        $('#product-form').reset(); 
        if(p){$('#product-modal-title').textContent="Редагувати продукт";$('#product-id').value=p.id;$('#product-name').value=p.name;$('#product-description').value=p.description;$('#product-notes').value=p.notes;$('#product-color').value=p.color}
        else{$('#product-modal-title').textContent="Новий продукт";$('#product-id').value=''} 
    }
    
    async function handleOpenProcedureModal() { 
        const date = state.selectedDate || new Date().toISOString().split('T')[0]; 
        if(!date){alert("Спочатку виберіть день у календарі!");return;} 
        const [cats,prods]=await Promise.all([getAllCategories(),getAllProducts()]);
        if(!prods.length||!cats.length){alert("Додайте хоча б один продукт та категорію!");return} 
        $('#procedure-category').innerHTML=cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); 
        $('#procedure-product').innerHTML=prods.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); 
        $('#procedure-date').value=date; 
        $('#procedure-time').value=new Date().toTimeString().substring(0,5); 
    }
    
    async function handleProcedureFormSubmit(e) { 
        e.preventDefault(); 
        await addCalendarEntry({date:$('#procedure-date').value,categoryId:Number($('#procedure-category').value),productId:Number($('#procedure-product').value),time:$('#procedure-time').value,notes:$('#procedure-notes').value.trim()}); 
        $('#procedure-form').reset(); 
        hideModal($('#procedure-modal'));
        await renderAll(); 
    }
    
    function handleApplyFilters() { 
        state.history.filters.categories = Array.from($$('#filter-categories-list input:checked')).map(i=>i.value); 
        state.history.filters.colors = Array.from($$('#filter-colors-list input:checked')).map(i=>i.value); 
        state.history.filters.dateFrom=$('#filter-date-from').value;
        state.history.filters.dateTo=$('#filter-date-to').value; 
        $('#filter-modal-overlay').classList.remove('visible'); 
        displayHistoryList(); 
    }
    
    function handleResetFilters() { 
        state.history.filters={categories:[],colors:[],dateFrom:'',dateTo:''}; 
        $$('#filter-modal-overlay input').forEach(i=>i.type==='checkbox'?i.checked=false:i.value=''); 
        $('#filter-modal-overlay').classList.remove('visible'); 
        displayHistoryList(); 
    }
    
    async function openSetModal(set=null) { 
        const [cats,prods]=await Promise.all([getAllCategories(),getAllProducts()]); 
        $('#set-category').innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); 
        $('#set-products-list').innerHTML = prods.map(p => `<label class="custom-checkbox"><input type="checkbox" value="${p.id}"><span class="checkmark">${ICONS.check}</span><span>${p.name}</span></label>`).join(''); 
        if(set){$('#set-modal-title').textContent="Редагувати сет";$('#set-id').value=set.id;$('#set-name').value=set.name;$('#set-category').value=set.categoryId;$$('#set-products-list input').forEach(chk=>{if(set.productIds.includes(Number(chk.value)))chk.checked=true})}
        else{$('#set-modal-title').textContent="Новий сет";$('#set-id').value=''}
    }
    
    async function handleSetFormSubmit(e) { 
        e.preventDefault(); 
        const ids=Array.from($$('#set-products-list input:checked')).map(i=>Number(i.value)); 
        if(!ids.length){alert('Виберіть хоча б один продукт.');return} 
        const id=Number($('#set-id').value); 
        const data={name:$('#set-name').value.trim(),categoryId:Number($('#set-category').value),productIds:ids}; 
        if(id){data.id=id;await updateSet(data)}
        else{await addSet(data)} 
        $('#set-form').reset(); 
        hideModal($('#set-modal'));
        await renderSets(); 
    }

    async function handleOpenSelectSetModal() { 
        if(!state.selectedDate){alert("Спочатку виберіть день у календарі!");return;} 
        const sets = await getAllSets(); 
        if(!sets.length){alert('Створіть хоча б один сет у Налаштуваннях.');return} 
        $('#set-select-list').innerHTML=sets.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); 
        $('#set-time').value=new Date().toTimeString().substring(0,5); 
    }
    
    async function handleApplySet(e) { 
        e.preventDefault(); 
        const setId=Number($('#set-select-list').value); 
        const time=$('#set-time').value; 
        const set=(await getAllSets()).find(s=>s.id===setId); 
        if(!set)return; 
        await Promise.all(set.productIds.map(prodId=>addCalendarEntry({date:state.selectedDate,categoryId:set.categoryId,productId:prodId,time,notes:`Із сету "${set.name}"`}))); 
        hideModal($('#select-set-modal'));
        await renderAll(); 
    }
    
    async function handleMoodSurveyClick(e) { 
        const moodButton = e.target.closest('.mood-btn'); 
        if (!moodButton) return; 
        const moodValue = moodButton.dataset.mood; 
        await addSkinSurvey({ date: new Date().toISOString().split('T')[0], mood: Number(moodValue) }); 
        showSurveyResult(moodValue); 
        await renderAnalyticsChart();
    }

    function showSurveyResult(mood) { 
        const emojiMap = { '5':'😀', '4':'🙂', '3':'😐', '2':'😕', '1':'😣' }; 
        // Ховаємо картку-опитування
        $('#skin-survey-card').classList.add('hidden');
        
        // Заповнюємо і показуємо рядок з результатом в картці догляду
        $('#skin-assessment-emoji').textContent = emojiMap[mood];
        $('#skin-assessment-content').classList.remove('hidden');
    }
    
    async function handleProfileFormSubmit(e) { 
        e.preventDefault(); 
        const name=$('#profile-name').value.trim(); 
        const photoFile=$('#profile-photo').files[0]; 
        let photoBase64=(await getProfile())?.photo||null; 
        if(photoFile){photoBase64=await new Promise(r=>{const reader=new FileReader();reader.onload=e=>r(e.target.result);reader.readAsDataURL(photoFile)})} 
        await updateProfile({name,photo:photoBase64}); 
        alert("Профіль збережено!"); 
        await renderHomePage(); 
        await updateHeader();
        $('#profile-page .back-btn').click(); 
    }
    
    function handleProfilePhotoChange(e) { 
        const file = e.target.files[0]; 
        if (file) { 
            const reader = new FileReader(); 
            reader.onload = (event) => { 
                const preview = $('#profile-photo-preview'); 
                preview.src = event.target.result; 
                preview.classList.remove('hidden'); 
            }; 
            reader.readAsDataURL(file); 
        } 
    }
    
    async function loadProfileData() { 
        const profile = await getProfile(); 
        if (profile) { 
            $('#profile-name').value = profile.name || ''; 
            const preview = $('#profile-photo-preview'); 
            if (profile.photo) { 
                preview.src = profile.photo; 
                preview.classList.remove('hidden'); 
            } else { 
                preview.classList.add('hidden'); 
            } 
        } 
    }
    
    function updateWeather() { 
        if (!navigator.geolocation) return; 
        navigator.geolocation.getCurrentPosition(async pos=>{
            const{latitude,longitude}=pos.coords;
            try{
                const res=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,uv_index`);
                const data=await res.json();
                $('#weather-temp').textContent=`${Math.round(data.current.temperature_2m)}°C`;
                const uv=Math.round(data.current.uv_index);
                const uvSpan=$('#uv-index');
                uvSpan.textContent=`UV ${uv}`;
                uvSpan.className='card-value';
                if(uv<=2)uvSpan.classList.add('low');
                else if(uv<=5)uvSpan.classList.add('medium');
                else uvSpan.classList.add('high');
                $('#weather-location').textContent=`Ваш регіон`;
            }catch(err){
                $('#weather-location').textContent=`Помилка погоди`;
            }
        }, () => {
             $('#weather-location').textContent = 'Доступ заборонено';
        }); 
    }

    async function handleHardRefresh() {
        try {
            if ('serviceWorker' in navigator) {
                console.log('Починаємо примусове оновлення...');
                
                // 1. Знаходимо реєстрацію Service Worker'а
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) {
                    console.log('Service Worker не знайдено, просто перезавантажуємо.');
                    location.reload(true);
                    return;
                }
                
                // 2. Викликаємо оновлення. Браузер перевірить, чи є нова версія SW на сервері.
                await registration.update();
                console.log('Перевірку оновлень завершено.');

                // 3. Роз-реєструємо його, щоб гарантувати, що наступне завантаження піде з мережі
                await registration.unregister();
                console.log('Service Worker видалено.');
            }

            // 4. Перезавантажуємо сторінку, ігноруючи кеш браузера
            // true в location.reload(true) є застарілим, але деякі браузери все ще реагують на нього.
            // Сучасний підхід - просто перезавантажити після unregister.
            window.location.reload();

        } catch (error) {
            console.error('Помилка під час примусового оновлення:', error);
            alert('Не вдалося виконати примусове оновлення.');
        }
    }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker зареєстровано успішно:', registration);
      })
      .catch(error => {
        console.log('Помилка реєстрації Service Worker:', error);
      });
  });
}

// === НОВА, НАДІЙНА ЛОГІКА ОНОВЛЕННЯ PWA (вставляємо в кінець main.js) ===
// const pwaManager = {
//     newWorker: null, // Зберігаємо посилання на новий SW

//     init: () => {
//         if ('serviceWorker' in navigator) {
//             navigator.serviceWorker.register('/service-worker.js')
//                 .then(registration => {
//                     console.log('Service Worker зареєстровано.');
                    
//                     // Не робимо нічого, якщо оновлень немає
//                     if (registration.waiting) {
//                         pwaManager.newWorker = registration.waiting;
//                         pwaManager.showUpdateBanner();
//                         return;
//                     }
                    
//                     // Відстежуємо появу нового SW
//                     registration.onupdatefound = () => {
//                         const installingWorker = registration.installing;
//                         installingWorker.onstatechange = () => {
//                             if (installingWorker.state === 'installed') {
//                                 if (navigator.serviceWorker.controller) {
//                                     pwaManager.newWorker = installingWorker;
//                                     pwaManager.showUpdateBanner();
//                                 }
//                             }
//                         };
//                     };
//                 }).catch(error => console.error('Помилка реєстрації SW:', error));
//         }
//     },

//     showUpdateBanner: () => {
//         const banner = document.getElementById('update-banner');
//         const reloadButton = document.getElementById('reload-button');
//         if (!banner || !reloadButton) return;
        
//         reloadButton.onclick = () => {
//             // Відправляємо повідомлення і ВІДРАЗУ Ж ПЕРЕЗАВАНТАЖУЄМО
//             if (pwaManager.newWorker) {
//                 pwaManager.newWorker.postMessage({ action: 'SKIP_WAITING' });
//                 // Не чекаємо на controllerchange, а просто перезавантажуємо після короткої паузи
//                 // Це дає час SW активуватися
//                 setTimeout(() => {
//                     window.location.reload();
//                 }, 100);
//             }
//         };

//         banner.classList.add('visible');
//     }
// };

// pwaManager.init();