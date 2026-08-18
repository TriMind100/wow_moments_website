document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // API Configuration (Vercel Client -> Render Server)
    // ----------------------------------------------------
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
        ? 'http://localhost:3000'
        : 'https://wow-moments-website-backend.onrender.com';
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    
    const templateForm = document.getElementById('template-form');
    const formError = document.getElementById('form-error');
    const formSuccess = document.getElementById('form-success');
    const adminTemplatesGrid = document.getElementById('admin-templates-grid');
    const templatesCount = document.getElementById('templates-count');

    // ----------------------------------------------------
    // Authenticated Fetch Helper
    // Sends credentials (cookies) and Authorization Bearer header
    // ----------------------------------------------------
    async function authFetch(url, options = {}) {
        const token = localStorage.getItem('admin_token');
        const headers = options.headers ? { ...options.headers } : {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
            ...options,
            credentials: 'include',
            headers
        });

        if (res.status === 401) {
            localStorage.removeItem('admin_token');
            showLogin();
        }

        return res;
    }

    // ----------------------------------------------------
    // Authentication Check
    // ----------------------------------------------------
    async function checkAuth() {
        const token = localStorage.getItem('admin_token');
        try {
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${API_BASE}/api/check-auth`, {
                credentials: 'include',
                headers
            });
            const data = await response.json();
            if (data.isAdmin) {
                showDashboard();
            } else {
                localStorage.removeItem('admin_token');
                showLogin();
            }
        } catch (err) {
            console.error('Error checking auth:', err);
            showLogin();
        }
    }

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadTemplates();
        loadReviews();
        loadInvites();
    }

    function showLogin() {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }

    // ----------------------------------------------------
    // Auth Event Listeners
    // ----------------------------------------------------
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                if (data.token) {
                    localStorage.setItem('admin_token', data.token);
                }
                showDashboard();
                loginForm.reset();
            } else {
                loginError.textContent = data.error || 'Login failed';
                loginError.classList.remove('hidden');
            }
        } catch (err) {
            loginError.textContent = 'Server error. Please try again.';
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await authFetch(`${API_BASE}/api/logout`, { method: 'POST' });
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            localStorage.removeItem('admin_token');
            showLogin();
        }
    });

    // ----------------------------------------------------
    // Template Management
    // ----------------------------------------------------
    async function loadTemplates() {
        try {
            const response = await authFetch(`${API_BASE}/api/templates`);
            const templates = await response.json();
            renderTemplatesList(templates);
        } catch (err) {
            console.error('Error loading templates:', err);
        }
    }

    let isEditing = false;
    let editId = null;
    let currentImageUrl = '';

    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const imageHelpText = document.getElementById('image-help-text');

    function renderTemplatesList(templates) {
        adminTemplatesGrid.innerHTML = '';
        templatesCount.textContent = `${templates.length} Templates`;

        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-100 rounded-2xl overflow-hidden p-3 flex gap-4 items-center shadow-sm relative group';

            // Price display: show original & discounted if on sale
            let priceHtml;
            if (t.discountPercent > 0 && t.originalPrice) {
                priceHtml = `
                    <span class="price-strike text-xs">${t.originalPrice}</span>
                    <span class="text-sm font-extrabold text-primary ml-1">${t.price}</span>
                    <span class="on-sale-badge inline-block ml-1 text-[9px] font-black uppercase tracking-wider text-white bg-primary px-1.5 py-0.5 rounded-full">${t.discountPercent}% OFF</span>
                `;
            } else {
                priceHtml = `<span class="text-sm font-semibold text-primary">${t.price}</span>`;
            }

            const imageUrl = t.image && t.image.startsWith('/') ? `${API_BASE}${t.image}` : t.image;
            card.innerHTML = `
                <img src="${imageUrl}" alt="${t.name}" class="w-20 h-20 object-cover rounded-xl bg-gray-50 flex-shrink-0">
                <div class="flex-grow min-w-0 pr-16">
                    <h3 class="font-bold text-base truncate">${t.name}</h3>
                    <div class="flex items-center flex-wrap gap-1 mt-0.5">${priceHtml}</div>
                    <p class="text-xs text-gray-400 mt-1 truncate">${t.description}</p>
                    ${t.tag ? `<span class="inline-block mt-2 text-[9px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full ${t.tagColor || 'bg-primary'}">${t.tag}</span>` : ''}
                </div>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <button data-id="${t.id}" class="edit-template-btn w-8 h-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all duration-200" title="Edit Template">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button data-id="${t.id}" class="delete-template-btn w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all duration-200" title="Delete Template">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            `;
            adminTemplatesGrid.appendChild(card);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this template?')) {
                    await deleteTemplate(id);
                }
            });
        });

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const template = templates.find(t => t.id === id);
                if (template) {
                    startEdit(template);
                }
            });
        });

        // Refresh sale panel template list whenever templates reload
        renderSaleTemplateList(templates);
    }

    function startEdit(template) {
        isEditing = true;
        editId = template.id;
        currentImageUrl = template.image;

        formTitle.textContent = 'Edit Template';
        formSubtitle.textContent = `Updating template: ${template.name}`;
        formSubmitBtn.textContent = 'Update Template';
        cancelEditBtn.classList.remove('hidden');
        imageHelpText.textContent = 'Leave empty to keep the current image.';

        // Populate fields
        templateForm.name.value = template.name;
        // Use original price if on sale so the field shows the real base price
        const basePriceStr = template.originalPrice || template.price;
        const priceNum = basePriceStr.replace(/[^\d]/g, '');
        templateForm.price.value = priceNum || basePriceStr;
        templateForm.tag.value = template.tag || '';
        templateForm.tagColor.value = template.tagColor || 'bg-primary';
        templateForm.description.value = template.description;
        templateForm.preview.value = template.preview || '';

        // Check categories
        document.querySelectorAll('input[name="categories"]').forEach(cb => {
            cb.checked = template.categories && template.categories.includes(cb.value);
        });

        // Clear image file input
        document.getElementById('imageFile').value = '';

        // Scroll to form
        formTitle.scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEdit() {
        isEditing = false;
        editId = null;
        currentImageUrl = '';

        formTitle.textContent = 'Create New Template';
        formSubtitle.textContent = 'Fill in details to add a template card to the grid.';
        formSubmitBtn.textContent = 'Add Template';
        cancelEditBtn.classList.add('hidden');
        imageHelpText.textContent = 'Select an image to upload to the server.';

        templateForm.reset();
        document.querySelectorAll('input[name="categories"]').forEach(cb => {
            cb.checked = false;
        });
    }

    cancelEditBtn.addEventListener('click', cancelEdit);

    async function deleteTemplate(id) {
        try {
            const response = await authFetch(`${API_BASE}/api/templates/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                if (isEditing && editId === id) {
                    cancelEdit();
                }
                loadTemplates();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete template');
            }
        } catch (err) {
            console.error('Error deleting template:', err);
            alert('Failed to delete template due to server error');
        }
    }

    // Handle template creation/edit form submit
    templateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.classList.add('hidden');
        formSuccess.classList.add('hidden');

        // Categories list
        const categories = [];
        document.querySelectorAll('input[name="categories"]:checked').forEach(cb => {
            categories.push(cb.value);
        });

        const formData = new FormData();
        formData.append('name', templateForm.name.value);
        formData.append('price', templateForm.price.value);
        formData.append('tag', templateForm.tag.value);
        formData.append('tagColor', templateForm.tagColor.value);
        formData.append('description', templateForm.description.value);
        formData.append('preview', templateForm.preview.value);
        formData.append('categories', categories.join(','));

        const imageFile = document.getElementById('imageFile').files[0];
        if (imageFile) {
            formData.append('imageFile', imageFile);
        } else if (isEditing) {
            formData.append('imageUrl', currentImageUrl);
        } else {
            formError.textContent = 'Please select a preview image file to upload.';
            formError.classList.remove('hidden');
            return;
        }

        const url = isEditing ? `${API_BASE}/api/templates/${editId}` : `${API_BASE}/api/templates`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await authFetch(url, {
                method: method,
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                formSuccess.textContent = isEditing ? 'Template updated successfully!' : 'Template posted successfully!';
                formSuccess.classList.remove('hidden');
                cancelEdit();
                loadTemplates();
            } else {
                formError.textContent = data.error || 'Failed to submit template';
                formError.classList.remove('hidden');
            }
        } catch (err) {
            formError.textContent = 'Server error. Failed to submit template.';
            formError.classList.remove('hidden');
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    //  SALE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────
    let saleTemplatesCache = [];   // latest list of templates
    let saleSelectedIds = new Set();
    let saleDiscountPct = 0;

    const saleTemplatesList   = document.getElementById('sale-templates-list');
    const discountPresets     = document.getElementById('discount-presets');
    const saleDiscountCustom  = document.getElementById('sale-discount-custom');
    const salePricePreview    = document.getElementById('sale-price-preview');
    const saleStatus          = document.getElementById('sale-status');
    const saleApplyBtn        = document.getElementById('sale-apply-btn');
    const saleClearAllBtn     = document.getElementById('sale-clear-all-btn');
    const saleSelectAllBtn    = document.getElementById('sale-select-all-btn');
    const saleDeselectAllBtn  = document.getElementById('sale-deselect-all-btn');

    /** Render the template checkboxes in the sale panel */
    function renderSaleTemplateList(templates) {
        saleTemplatesCache = templates;
        saleTemplatesList.innerHTML = '';

        if (!templates.length) {
            saleTemplatesList.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">No templates found.</p>';
            return;
        }

        templates.forEach(t => {
            const onSale = t.discountPercent > 0 && t.originalPrice;
            const isSelected = saleSelectedIds.has(t.id);

            const item = document.createElement('label');
            item.className = `sale-template-item flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${isSelected ? 'selected' : ''}`;
            item.setAttribute('for', `sale-chk-${t.id}`);

            // Price display
            const priceDisplay = onSale
                ? `<span class="price-strike text-[10px]">${t.originalPrice}</span><span class="text-[10px] font-extrabold text-primary ml-1">${t.price}</span><span class="ml-1 text-[8px] font-black text-white bg-primary px-1 py-0.5 rounded-full">${t.discountPercent}% OFF</span>`
                : `<span class="text-[10px] font-semibold text-gray-600">${t.price}</span>`;

            item.innerHTML = `
                <input type="checkbox" id="sale-chk-${t.id}" class="rounded border-gray-300 text-primary focus:ring-primary"
                    ${isSelected ? 'checked' : ''}>
                <img src="${t.image && t.image.startsWith('/') ? `${API_BASE}${t.image}` : t.image}" alt="${t.name}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-gray-100">
                <div class="flex-grow min-w-0">
                    <p class="text-xs font-bold truncate">${t.name}</p>
                    <div class="flex items-center gap-1 flex-wrap mt-0.5">${priceDisplay}</div>
                </div>
            `;

            // Toggle selection
            item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                if (e.target.checked) {
                    saleSelectedIds.add(t.id);
                    item.classList.add('selected');
                } else {
                    saleSelectedIds.delete(t.id);
                    item.classList.remove('selected');
                }
                updateSalePricePreview();
            });

            saleTemplatesList.appendChild(item);
        });

        updateSalePricePreview();
        // Sync banner panel visibility after template list is (re)rendered
        if (typeof syncBannerPanelVisibility === 'function') {
            syncBannerPanelVisibility(templates);
        }
    }

    /** Refresh the live price preview panel */
    function updateSalePricePreview() {
        const selected = saleTemplatesCache.filter(t => saleSelectedIds.has(t.id));

        if (!selected.length || !saleDiscountPct) {
            salePricePreview.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Select templates &amp; discount to preview prices.</p>';
            return;
        }

        salePricePreview.innerHTML = selected.map(t => {
            const basePriceStr = t.originalPrice || t.price;
            const baseNum = parseFloat(basePriceStr.replace(/[^\d.]/g, ''));
            const discounted = Math.round(baseNum * (1 - saleDiscountPct / 100));
            return `
                <div class="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span class="font-semibold text-gray-700 truncate mr-2">${t.name}</span>
                    <span class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="price-strike">${basePriceStr}</span>
                        <span class="font-extrabold text-primary">₹${discounted}</span>
                        <span class="text-[9px] font-black text-white bg-primary px-1.5 py-0.5 rounded-full">${saleDiscountPct}% OFF</span>
                    </span>
                </div>
            `;
        }).join('');
    }

    /** Set active discount and deactivate others */
    function setDiscount(pct) {
        saleDiscountPct = pct;
        // Highlight active preset
        document.querySelectorAll('.discount-preset-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.pct) === pct);
        });
        updateSalePricePreview();
    }

    // Preset buttons
    discountPresets.addEventListener('click', (e) => {
        const btn = e.target.closest('.discount-preset-btn');
        if (!btn) return;
        const pct = parseFloat(btn.dataset.pct);
        saleDiscountCustom.value = '';
        setDiscount(pct);
    });

    // Custom input
    saleDiscountCustom.addEventListener('input', () => {
        const val = parseFloat(saleDiscountCustom.value);
        if (val > 0 && val < 100) {
            // Deactivate all presets
            document.querySelectorAll('.discount-preset-btn').forEach(b => b.classList.remove('active'));
            saleDiscountPct = val;
            updateSalePricePreview();
        }
    });

    // Select / Deselect all
    saleSelectAllBtn.addEventListener('click', () => {
        saleTemplatesCache.forEach(t => saleSelectedIds.add(t.id));
        renderSaleTemplateList(saleTemplatesCache);
    });

    saleDeselectAllBtn.addEventListener('click', () => {
        saleSelectedIds.clear();
        renderSaleTemplateList(saleTemplatesCache);
    });

    /** Show status message in sale panel */
    function showSaleStatus(msg, isError = false) {
        saleStatus.textContent = msg;
        saleStatus.className = `text-sm font-semibold mt-1 ${isError ? 'text-red-600' : 'text-green-600'}`;
        saleStatus.classList.remove('hidden');
        setTimeout(() => saleStatus.classList.add('hidden'), 4000);
    }

    // Apply Sale button
    saleApplyBtn.addEventListener('click', async () => {
        if (!saleSelectedIds.size) {
            showSaleStatus('Please select at least one template.', true);
            return;
        }
        if (!saleDiscountPct || saleDiscountPct <= 0 || saleDiscountPct >= 100) {
            showSaleStatus('Please choose a valid discount (1–99%).', true);
            return;
        }

        saleApplyBtn.disabled = true;
        saleApplyBtn.textContent = 'Applying…';

        try {
            const res = await authFetch(`${API_BASE}/api/sales/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateIds: [...saleSelectedIds],
                    discountPercent: saleDiscountPct
                })
            });
            const data = await res.json();

            if (res.ok) {
                showSaleStatus(`Sale applied to ${data.updated.length} template(s)! 🎉`);
                loadTemplates(); // refreshes grid + sale panel
            } else {
                showSaleStatus(data.error || 'Failed to apply sale.', true);
            }
        } catch (err) {
            showSaleStatus('Server error. Please try again.', true);
        } finally {
            saleApplyBtn.disabled = false;
            saleApplyBtn.innerHTML = '<span class="material-symbols-outlined text-lg">bolt</span> Apply Sale';
        }
    });

    // Clear All Sales button
    saleClearAllBtn.addEventListener('click', async () => {
        if (!confirm('Clear ALL active sales and restore original prices?')) return;

        saleClearAllBtn.disabled = true;
        saleClearAllBtn.textContent = 'Clearing…';

        try {
            const res = await authFetch(`${API_BASE}/api/sales/clear`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (res.ok) {
                showSaleStatus(`Cleared ${data.clearedCount} sale(s). Prices restored.`);
                saleSelectedIds.clear();
                loadTemplates();
                // Auto-deactivate banner when sale is cleared
                await deactivateBanner(true /* silent */);
            } else {
                showSaleStatus(data.error || 'Failed to clear sales.', true);
            }
        } catch (err) {
            showSaleStatus('Server error. Please try again.', true);
        } finally {
            saleClearAllBtn.disabled = false;
            saleClearAllBtn.innerHTML = '<span class="material-symbols-outlined text-base">remove_shopping_cart</span> Clear All Sales';
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    //  SALE BANNER MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────
    const bannerPanel        = document.getElementById('banner-panel');
    const bannerDropzone     = document.getElementById('banner-dropzone');
    const bannerImageFile    = document.getElementById('banner-image-file');
    const bannerImageUrl     = document.getElementById('banner-image-url');
    const bannerCaptionInput = document.getElementById('banner-caption');
    const bannerCtaText      = document.getElementById('banner-cta-text');
    const bannerCtaLink      = document.getElementById('banner-cta-link');
    const bannerSaveBtn      = document.getElementById('banner-save-btn');
    const bannerRemoveBtn    = document.getElementById('banner-remove-btn');
    const bannerLiveBadge    = document.getElementById('banner-live-badge');
    const bannerStatusEl     = document.getElementById('banner-status');

    // Preview elements
    const bannerPreviewImg         = document.getElementById('banner-preview-img');
    const bannerPreviewPlaceholder = document.getElementById('banner-preview-placeholder');
    const bannerPreviewCaption     = document.getElementById('banner-preview-caption');
    const bannerPreviewCta         = document.getElementById('banner-preview-cta');

    // Tracks whether banner panel should be shown (based on active sales)
    let bannerPanelVisible = false;

    /** Show/hide banner panel based on whether any template is on sale */
    function syncBannerPanelVisibility(templates) {
        const hasActiveSale = templates.some(t => t.discountPercent > 0);
        if (hasActiveSale && !bannerPanelVisible) {
            bannerPanel.classList.remove('hidden');
            bannerPanelVisible = true;
            loadBannerState(); // refresh badge / form on first show
        } else if (!hasActiveSale && bannerPanelVisible) {
            bannerPanel.classList.add('hidden');
            bannerPanelVisible = false;
        }
    }

    /** Set banner preview image from data URL or external URL */
    function setBannerPreviewImage(src) {
        if (src) {
            bannerPreviewImg.src = src;
            bannerPreviewImg.classList.remove('hidden');
            bannerPreviewPlaceholder.classList.add('hidden');
        } else {
            bannerPreviewImg.src = '';
            bannerPreviewImg.classList.add('hidden');
            bannerPreviewPlaceholder.classList.remove('hidden');
        }
    }

    /** Update live preview caption and CTA */
    function updateBannerPreviewMeta() {
        const cap = bannerCaptionInput.value.trim();
        if (cap) {
            bannerPreviewCaption.textContent = cap;
            bannerPreviewCaption.classList.remove('hidden');
        } else {
            bannerPreviewCaption.classList.add('hidden');
        }
        bannerPreviewCta.textContent = bannerCtaText.value.trim() || 'Shop Sale';
    }

    /** Load existing banner from API and populate the form / badge */
    async function loadBannerState() {
        try {
            const res = await authFetch(`${API_BASE}/api/banner`);
            const data = await res.json();
            if (data.active) {
                setBannerPreviewImage(data.image);
                bannerCaptionInput.value = data.caption || '';
                bannerCtaText.value    = data.ctaText  || 'Shop Sale';
                bannerCtaLink.value    = data.ctaLink  || '#templates';
                updateBannerPreviewMeta();
                // Show live badge + remove button
                bannerLiveBadge.classList.remove('hidden');
                bannerLiveBadge.classList.add('flex');
                bannerRemoveBtn.classList.remove('hidden');
                bannerRemoveBtn.classList.add('flex');
            } else {
                bannerLiveBadge.classList.add('hidden');
                bannerLiveBadge.classList.remove('flex');
                bannerRemoveBtn.classList.add('hidden');
                bannerRemoveBtn.classList.remove('flex');
            }
        } catch (err) {
            console.error('Error loading banner state:', err);
        }
    }

    /** Show status in banner panel */
    function showBannerStatus(msg, isError = false) {
        bannerStatusEl.textContent = msg;
        bannerStatusEl.className = `text-sm font-semibold mt-1 ${isError ? 'text-red-600' : 'text-green-600'}`;
        bannerStatusEl.classList.remove('hidden');
        setTimeout(() => bannerStatusEl.classList.add('hidden'), 4000);
    }

    /** Deactivate banner via API */
    async function deactivateBanner(silent = false) {
        try {
            const res = await authFetch(`${API_BASE}/api/banner`, { method: 'DELETE' });
            if (res.ok) {
                bannerLiveBadge.classList.add('hidden');
                bannerLiveBadge.classList.remove('flex');
                bannerRemoveBtn.classList.add('hidden');
                bannerRemoveBtn.classList.remove('flex');
                setBannerPreviewImage(null);
                if (!silent) showBannerStatus('Banner removed. Popup is now hidden on the site.');
            } else {
                if (!silent) showBannerStatus('Failed to remove banner.', true);
            }
        } catch (err) {
            if (!silent) showBannerStatus('Server error. Please try again.', true);
        }
    }

    // ── Dropzone: click to choose file ────────────────────────────────────
    bannerDropzone.addEventListener('click', () => bannerImageFile.click());

    // ── Drag and drop ─────────────────────────────────────────────────────
    bannerDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        bannerDropzone.classList.add('drag-over');
    });
    bannerDropzone.addEventListener('dragleave', () => {
        bannerDropzone.classList.remove('drag-over');
    });
    bannerDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        bannerDropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            bannerImageFile.files = e.dataTransfer.files;
            handleBannerFileSelected(file);
        }
    });

    // ── File input change ─────────────────────────────────────────────────
    bannerImageFile.addEventListener('change', () => {
        const file = bannerImageFile.files[0];
        if (file) handleBannerFileSelected(file);
    });

    function handleBannerFileSelected(file) {
        bannerImageUrl.value = ''; // clear URL if file chosen
        const reader = new FileReader();
        reader.onload = (e) => setBannerPreviewImage(e.target.result);
        reader.readAsDataURL(file);
        // Update dropzone label
        bannerDropzone.querySelector('p').textContent = `✓ ${file.name}`;
    }

    // ── URL input ─────────────────────────────────────────────────────────
    bannerImageUrl.addEventListener('input', () => {
        const url = bannerImageUrl.value.trim();
        if (url) {
            // Clear file input
            bannerImageFile.value = '';
            bannerDropzone.querySelector('p').textContent = 'Drag & drop or click to choose';
            setBannerPreviewImage(url);
        } else {
            setBannerPreviewImage(null);
        }
    });

    // ── Caption / CTA live preview ────────────────────────────────────────
    bannerCaptionInput.addEventListener('input', updateBannerPreviewMeta);
    bannerCtaText.addEventListener('input',      updateBannerPreviewMeta);

    // ── Save / Activate Banner ────────────────────────────────────────────
    bannerSaveBtn.addEventListener('click', async () => {
        const file  = bannerImageFile.files[0];
        const url   = bannerImageUrl.value.trim();

        if (!file && !url) {
            showBannerStatus('Please upload an image or enter an image URL.', true);
            return;
        }

        bannerSaveBtn.disabled = true;
        bannerSaveBtn.innerHTML = '<span class="material-symbols-outlined text-lg">hourglass_top</span> Saving…';

        try {
            const formData = new FormData();
            if (file) formData.append('bannerImage', file);
            else       formData.append('imageUrl', url);
            formData.append('caption', bannerCaptionInput.value.trim());
            formData.append('ctaText', bannerCtaText.value.trim() || 'Shop Sale');
            formData.append('ctaLink', bannerCtaLink.value.trim() || '#templates');

            const res  = await authFetch(`${API_BASE}/api/banner`, { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                showBannerStatus('🎉 Banner saved and live on the website!');
                bannerLiveBadge.classList.remove('hidden');
                bannerLiveBadge.classList.add('flex');
                bannerRemoveBtn.classList.remove('hidden');
                bannerRemoveBtn.classList.add('flex');
            } else {
                showBannerStatus(data.error || 'Failed to save banner.', true);
            }
        } catch (err) {
            showBannerStatus('Server error. Please try again.', true);
        } finally {
            bannerSaveBtn.disabled = false;
            bannerSaveBtn.innerHTML = '<span class="material-symbols-outlined text-lg">upload</span> Save & Activate Banner';
        }
    });

    // ── Remove Banner ─────────────────────────────────────────────────────
    bannerRemoveBtn.addEventListener('click', async () => {
        if (!confirm('Remove the sale banner? Visitors will no longer see the popup.')) return;
        bannerRemoveBtn.disabled = true;
        await deactivateBanner(false);
        bannerRemoveBtn.disabled = false;
    });

    // ----------------------------------------------------------------
    // Reviews Management
    // ----------------------------------------------------------------
    const adminReviewForm = document.getElementById('admin-review-form');
    const adminRevFormTitle = document.getElementById('admin-rev-form-title');
    const adminRevFormSubtitle = document.getElementById('admin-rev-form-subtitle');
    const adminRevSubmitBtn = document.getElementById('admin-rev-submit-btn');
    const adminRevCancelBtn = document.getElementById('admin-rev-cancel-btn');
    const adminRevError = document.getElementById('admin-rev-error');
    const adminRevSuccess = document.getElementById('admin-rev-success');
    const adminReviewsList = document.getElementById('admin-reviews-list');
    const adminReviewsCount = document.getElementById('admin-reviews-count');

    let isRevEditing = false;
    let revEditId = null;
    let currentRevAvatarUrl = null;
    let reviewsList = [];
    let currentRevFilter = 'all';

    // Moderation Filter Buttons
    const filterBtns = document.querySelectorAll('.rev-filter-btn');
    const countAllEl = document.getElementById('count-all');
    const countPendingEl = document.getElementById('count-pending');
    const countApprovedEl = document.getElementById('count-approved');
    const pendingBadge = document.getElementById('admin-pending-badge');
    const pendingAlertBox = document.getElementById('pending-alert-box');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRevFilter = btn.getAttribute('data-filter');
            filterBtns.forEach(b => {
                b.classList.remove('bg-white', 'shadow-sm', 'text-gray-800');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('bg-white', 'shadow-sm', 'text-gray-800');
            btn.classList.remove('text-gray-500');
            renderAdminReviewsList(reviewsList);
        });
    });

    async function loadReviews() {
        if (!adminReviewsList) return;
        try {
            const response = await authFetch(`${API_BASE}/api/reviews/admin`);
            if (response.ok) {
                reviewsList = await response.json();
                renderAdminReviewsList(reviewsList);
            }
        } catch (err) {
            console.error('Error loading reviews:', err);
        }
    }

    function renderAdminReviewsList(reviews) {
        adminReviewsList.innerHTML = '';
        
        const totalCount = reviews.length;
        const pendingCount = reviews.filter(r => r.status === 'pending').length;
        const approvedCount = reviews.filter(r => r.status === 'approved').length;

        if (countAllEl) countAllEl.textContent = totalCount;
        if (countPendingEl) countPendingEl.textContent = pendingCount;
        if (countApprovedEl) countApprovedEl.textContent = approvedCount;

        if (pendingBadge) {
            if (pendingCount > 0) {
                pendingBadge.textContent = `${pendingCount} Needs Approval`;
                pendingBadge.classList.remove('hidden');
            } else {
                pendingBadge.classList.add('hidden');
            }
        }

        if (pendingAlertBox) {
            if (pendingCount > 0) {
                pendingAlertBox.classList.remove('hidden');
            } else {
                pendingAlertBox.classList.add('hidden');
            }
        }

        // Apply filter
        let filteredReviews = reviews;
        if (currentRevFilter === 'pending') {
            filteredReviews = reviews.filter(r => r.status === 'pending');
        } else if (currentRevFilter === 'approved') {
            filteredReviews = reviews.filter(r => r.status === 'approved');
        }

        if (filteredReviews.length === 0) {
            const emptyMsg = currentRevFilter === 'pending'
                ? '🎉 All caught up! No pending reviews awaiting approval.'
                : currentRevFilter === 'approved'
                ? 'No live reviews yet. Approve pending submissions or add one directly!'
                : 'No reviews found.';
            adminReviewsList.innerHTML = `<div class="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center text-xs text-gray-400 font-medium">${emptyMsg}</div>`;
            return;
        }

        filteredReviews.forEach(r => {
            const isApproved = r.status === 'approved';
            const card = document.createElement('div');
            card.className = `rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-sm relative group transition-all duration-200 ${
                isApproved 
                    ? 'bg-white border border-gray-100 hover:border-gray-200' 
                    : 'bg-amber-50/40 border-2 border-amber-300 hover:border-amber-400'
            }`;

            // Moderation Status Badge
            const statusBadge = isApproved
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>Live on Site</span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">⚡ Pending Approval</span>`;

            // Star icons rating
            let ratingStars = '';
            for (let i = 1; i <= 5; i++) {
                ratingStars += `<span class="material-symbols-outlined text-xs text-yellow-500" style="font-variation-settings: 'FILL' ${i <= r.rating ? 1 : 0}">star</span>`;
            }

            // Avatar helper
            let avatarHtml;
            if (r.avatar) {
                avatarHtml = `<img src="${r.avatar}" alt="${r.name}" class="w-12 h-12 object-cover rounded-full bg-gray-50 flex-shrink-0 border border-gray-100 shadow-xs">`;
            } else {
                const initials = r.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                avatarHtml = `<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 shadow-xs">${initials}</div>`;
            }

            // Action buttons HTML
            const approveButtonHtml = !isApproved
                ? `
                    <button data-id="${r.id}" data-action="approve" class="px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow active:scale-95 transition-all duration-150" title="Approve & Publish to Website">
                        <span class="material-symbols-outlined text-sm">check_circle</span>
                        <span>Approve Review</span>
                    </button>
                `
                : `
                    <button data-id="${r.id}" data-action="unapprove" class="px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all duration-150" title="Hide this review from live website">
                        <span class="material-symbols-outlined text-xs">visibility_off</span>
                        <span>Hide</span>
                    </button>
                `;

            card.innerHTML = `
                <div class="flex items-start gap-3 flex-grow min-w-0">
                    ${avatarHtml}
                    <div class="flex-grow min-w-0 pr-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-extrabold text-sm text-gray-900">${r.name}</h4>
                            ${statusBadge}
                        </div>
                        <div class="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            ${r.location ? `<span class="font-medium text-gray-500">${r.location}</span> • ` : ''}
                            <span>${new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div class="flex gap-0.5 my-1.5">${ratingStars}</div>
                        <p class="text-xs text-gray-700 italic bg-white/60 p-2.5 rounded-xl border border-gray-100">"${r.comment}"</p>
                    </div>
                </div>

                <!-- Action Controls -->
                <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    ${approveButtonHtml}
                    <div class="flex items-center gap-1.5">
                        <button data-id="${r.id}" data-action="edit" class="w-7 h-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all duration-150 active:scale-95" title="Edit Review Details">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button data-id="${r.id}" data-action="delete" class="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all duration-150 active:scale-95" title="Delete Review">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </div>
            `;
            adminReviewsList.appendChild(card);
        });

        // Add event listeners to review action buttons
        adminReviewsList.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                const review = reviewsList.find(r => r.id === id);

                if (!review) return;

                if (action === 'approve') {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Approving...';
                    await updateReviewStatus(review, 'approved');
                } else if (action === 'unapprove') {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xs">sync</span>';
                    await updateReviewStatus(review, 'pending');
                } else if (action === 'edit') {
                    startEditReview(review);
                } else if (action === 'delete') {
                    if (confirm(`Are you sure you want to permanently delete the review from "${review.name}"?`)) {
                        await deleteReview(review.id);
                    }
                }
            });
        });
    }

    async function updateReviewStatus(review, newStatus) {
        try {
            const res = await authFetch(`${API_BASE}/api/reviews/${review.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                await loadReviews();
            } else {
                alert(data.error || 'Failed to update review status.');
                await loadReviews();
            }
        } catch (err) {
            console.error('Error updating review status:', err);
            alert('Server error updating review status. Please try again.');
            await loadReviews();
        }
    }

    function startEditReview(review) {
        isRevEditing = true;
        revEditId = review.id;
        currentRevAvatarUrl = review.avatar;

        adminRevFormTitle.textContent = 'Edit Review';
        adminRevFormSubtitle.textContent = `Updating feedback from: ${review.name}`;
        adminRevSubmitBtn.textContent = 'Update Review';
        adminRevCancelBtn.classList.remove('hidden');
        document.getElementById('admin-rev-avatar-help').textContent = 'Leave empty to keep current avatar.';

        adminReviewForm.name.value = review.name;
        adminReviewForm.location.value = review.location || '';
        adminReviewForm.rating.value = review.rating;
        adminReviewForm.comment.value = review.comment;
        adminReviewForm.status.value = review.status;

        document.getElementById('admin-rev-avatar').value = '';

        adminRevFormTitle.scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEditReview() {
        isRevEditing = false;
        revEditId = null;
        currentRevAvatarUrl = null;

        adminRevFormTitle.textContent = 'Add New Review';
        adminRevFormSubtitle.textContent = 'Post directly as an approved testimonial.';
        adminRevSubmitBtn.textContent = 'Add Review';
        adminRevCancelBtn.classList.add('hidden');
        document.getElementById('admin-rev-avatar-help').textContent = 'Leave empty to use initials fallback.';

        adminReviewForm.reset();
    }

    if (adminRevCancelBtn) {
        adminRevCancelBtn.addEventListener('click', cancelEditReview);
    }

    async function deleteReview(id) {
        try {
            const res = await authFetch(`${API_BASE}/api/reviews/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (isRevEditing && revEditId === id) cancelEditReview();
                loadReviews();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to delete review');
            }
        } catch (err) {
            console.error('Error deleting review:', err);
        }
    }

    if (adminReviewForm) {
        adminReviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            adminRevError.classList.add('hidden');
            adminRevSuccess.classList.add('hidden');

            const submitBtn = document.getElementById('admin-rev-submit-btn');
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xs">sync</span> Saving...';

            const formData = new FormData(adminReviewForm);
            
            // Handle avatar URL preservation when editing
            const avatarFile = document.getElementById('admin-rev-avatar').files[0];
            if (!avatarFile && isRevEditing && currentRevAvatarUrl) {
                formData.append('avatarUrl', currentRevAvatarUrl);
            }

            const url = isRevEditing ? `${API_BASE}/api/reviews/${revEditId}/edit` : `${API_BASE}/api/reviews`;
            const method = 'POST';

            try {
                const res = await authFetch(url, {
                    method: method,
                    body: formData
                });

                const data = await res.json();
                if (res.ok) {
                    adminRevSuccess.textContent = isRevEditing ? 'Review updated successfully!' : 'Review added successfully!';
                    adminRevSuccess.classList.remove('hidden');
                    cancelEditReview();
                    loadReviews();
                } else {
                    adminRevError.textContent = data.error || 'Failed to submit review';
                    adminRevError.classList.remove('hidden');
                }
            } catch (err) {
                console.error('Error submitting review form:', err);
                adminRevError.textContent = 'Server error. Failed to submit review.';
                adminRevError.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // ----------------------------------------------------------------
    // Review Invitation Links
    // ----------------------------------------------------------------
    const btnGenSingle = document.getElementById('btn-gen-single-invite');
    const btnGenMulti = document.getElementById('btn-gen-multi-invite');
    const invitesTableBody = document.getElementById('invites-table-body');

    async function loadInvites() {
        if (!invitesTableBody) return;
        try {
            const res = await authFetch(`${API_BASE}/api/reviews/invites`);
            if (res.ok) {
                const invites = await res.json();
                renderInvitesList(invites);
            }
        } catch (err) {
            console.error('Error loading invites:', err);
        }
    }

    function renderInvitesList(invites) {
        invitesTableBody.innerHTML = '';
        if (invites.length === 0) {
            invitesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-6 text-center text-gray-400">No active review request links. Generate one above!</td>
                </tr>
            `;
            return;
        }

        invites.forEach(inv => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-50 hover:bg-gray-50/50 transition-colors';

            const inviteUrl = `${window.location.origin}/write-review.html?token=${inv.token}`;

            const isUsed = inv.status === 'used';
            const statusBadge = isUsed
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400 border border-gray-200">Used / Expired</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">Active</span>`;

            const typeBadge = inv.type === 'single'
                ? `<span class="text-xs text-gray-600 font-medium">Single-Use</span>`
                : `<span class="text-xs text-[#b90a5a] font-bold">Multi-Use</span>`;

            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono text-[10px] text-gray-500 max-w-[200px] sm:max-w-[300px] truncate select-all" title="${inviteUrl}">
                    ${inviteUrl}
                </td>
                <td class="py-3.5 px-4">${typeBadge}</td>
                <td class="py-3.5 px-4">${statusBadge}</td>
                <td class="py-3.5 px-4 text-center font-bold text-gray-700">${inv.submissions || 0}</td>
                <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button data-url="${inviteUrl}" class="copy-invite-btn px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1 transition-all duration-150 active:scale-95">
                            <span class="material-symbols-outlined text-[12px]">content_copy</span>
                            Copy
                        </button>
                        <button data-token="${inv.token}" class="delete-invite-btn w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all duration-150 active:scale-95">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            `;
            invitesTableBody.appendChild(tr);
        });

        // Copy button listeners
        invitesTableBody.querySelectorAll('.copy-invite-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                navigator.clipboard.writeText(url).then(() => {
                    const origText = btn.innerHTML;
                    btn.innerHTML = `<span class="material-symbols-outlined text-[12px]">check</span> Copied!`;
                    btn.classList.replace('bg-primary/5', 'bg-green-50');
                    btn.classList.replace('text-primary', 'text-green-700');
                    setTimeout(() => {
                        btn.innerHTML = origText;
                        btn.classList.replace('bg-green-50', 'bg-primary/5');
                        btn.classList.replace('text-green-700', 'text-primary');
                    }, 1500);
                });
            });
        });

        // Delete button listeners
        invitesTableBody.querySelectorAll('.delete-invite-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const token = btn.getAttribute('data-token');
                if (confirm('Are you sure you want to delete/revoke this review link? Customers will no longer be able to use it.')) {
                    await deleteInvite(token);
                }
            });
        });
    }

    async function createInvite(type) {
        try {
            const res = await authFetch(`${API_BASE}/api/reviews/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            if (res.ok) {
                loadInvites();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to generate review link');
            }
        } catch (err) {
            console.error('Error creating invite:', err);
        }
    }

    async function deleteInvite(token) {
        try {
            const res = await authFetch(`${API_BASE}/api/reviews/invites/${token}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                loadInvites();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete invite');
            }
        } catch (err) {
            console.error('Error deleting invite:', err);
        }
    }

    if (btnGenSingle) {
        btnGenSingle.addEventListener('click', () => createInvite('single'));
    }
    if (btnGenMulti) {
        btnGenMulti.addEventListener('click', () => createInvite('multi'));
    }

    // Run auth check on load
    checkAuth();
});
