document.addEventListener('DOMContentLoaded', () => {
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
    // Authentication Check
    // ----------------------------------------------------
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            if (data.isAdmin) {
                showDashboard();
            } else {
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
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok && data.success) {
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
            await fetch('/api/logout', { method: 'POST' });
            showLogin();
        } catch (err) {
            console.error('Logout error:', err);
        }
    });

    // ----------------------------------------------------
    // Template Management
    // ----------------------------------------------------
    async function loadTemplates() {
        try {
            const response = await fetch('/api/templates');
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
            card.innerHTML = `
                <img src="${t.image}" alt="${t.name}" class="w-20 h-20 object-cover rounded-xl bg-gray-50 flex-shrink-0">
                <div class="flex-grow min-w-0 pr-16">
                    <h3 class="font-bold text-base truncate">${t.name}</h3>
                    <p class="text-sm font-semibold text-primary mt-0.5">${t.price}</p>
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
        const priceNum = template.price.replace(/[^\d]/g, '');
        templateForm.price.value = priceNum || template.price;
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
            const response = await fetch(`/api/templates/${id}`, {
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

        const url = isEditing ? `/api/templates/${editId}` : '/api/templates';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
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

    // Run auth check on load
    checkAuth();
});
