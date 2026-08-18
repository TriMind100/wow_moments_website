document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------
    // API Configuration (Vercel Client -> Render Server)
    // ----------------------------------------------------------------
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
        ? 'http://localhost:3000'
        : 'https://wow-moments-website-backend.onrender.com';
    // ----------------------------------------------------------------
    // 1. WebGL Background Animation (Safely isolated for mobile)
    // ----------------------------------------------------------------
    (function () {
        try {
            const canvas = document.getElementById('shader-canvas-ANIMATION_55');
            if (!canvas) return;

            // Sync the WebGL drawing-buffer size with the CSS-driven layout size.
            function syncSize() {
                const w = canvas.clientWidth || 1280;
                const h = canvas.clientHeight || 720;
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
            }
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(syncSize).observe(canvas);
            }
            syncSize();

            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return;
            const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
            const fs = `precision mediump float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_texCoord;
    
    // Create soft, flowing blobs
    float noise = 0.0;
    vec2 center1 = vec2(0.5 + 0.3 * cos(u_time * 0.5), 0.5 + 0.2 * sin(u_time * 0.3));
    vec2 center2 = vec2(0.5 + 0.2 * sin(u_time * 0.4), 0.5 + 0.3 * cos(u_time * 0.6));
    
    float dist1 = length(uv - center1);
    float dist2 = length(uv - center2);
    
    float blob1 = smoothstep(0.6, 0.0, dist1);
    float blob2 = smoothstep(0.5, 0.0, dist2);
    
    // Wow Moments Palette
    vec3 color1 = vec3(1.0, 0.30, 0.55); // #FF4D8D
    vec3 color2 = vec3(1.0, 0.56, 0.67); // #FF8FAB
    vec3 color3 = vec3(1.0, 1.0, 1.0);    // White
    
    vec3 finalColor = mix(color3, color1, blob1);
    finalColor = mix(finalColor, color2, blob2);
    
    // Add a very subtle grain
    float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    finalColor += (grain - 0.5) * 0.03;
    
    gl_FragColor = vec4(finalColor, 0.15); // High transparency for background use
}`;
            function cs(type, src) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                return s;
            }
            const prog = gl.createProgram();
            gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
            gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
            gl.linkProgram(prog);
            gl.useProgram(prog);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            const pos = gl.getAttribLocation(prog, 'a_position');
            gl.enableVertexAttribArray(pos);
            gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
            const uTime = gl.getUniformLocation(prog, 'u_time');
            const uRes = gl.getUniformLocation(prog, 'u_resolution');
            const uMouse = gl.getUniformLocation(prog, 'u_mouse');

            let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
            window.addEventListener('mousemove', (event) => {
                const rect = canvas.getBoundingClientRect();
                if (rect.width && rect.height) {
                    const nx = (event.clientX - rect.left) / rect.width;
                    const ny = 1.0 - (event.clientY - rect.top) / rect.height;
                    mouse.x = nx * canvas.width;
                    mouse.y = ny * canvas.height;
                }
            });

            function render(t) {
                if (typeof ResizeObserver === 'undefined') syncSize();
                gl.viewport(0, 0, canvas.width, canvas.height);
                if (uTime) gl.uniform1f(uTime, t * 0.001);
                if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
                if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                requestAnimationFrame(render);
            }
            render(0);
        } catch (e) {
            console.warn('WebGL shader background fallback:', e);
        }
    })();

    // ----------------------------------------------------------------
    // Safe LocalStorage Helper (Prevents mobile private mode errors)
    // ----------------------------------------------------------------
    const safeStorage = {
        getItem: (key) => {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        setItem: (key, val) => {
            try { localStorage.setItem(key, val); } catch (e) {}
        }
    };

    // ----------------------------------------------------------------
    // 2. CMS Simulation: Load and Render Templates
    // ----------------------------------------------------------------
    const grid = document.getElementById('templates-grid');

    // High-performance default templates baked into client for 0ms instant display on mobile/desktop
    const DEFAULT_TEMPLATES = [
        {
            id: "t1",
            name: "A Love That Defies Time!",
            price: "₹379",
            tag: "Trending",
            tagColor: "bg-amber-500",
            description: "Cinematic, interactive romantic story with dynamic particles, floating hearts, love timer, timeline, photo gallery, and a secret card reveal.",
            image: "assets/love_story_preview.png",
            preview: "https://wowmoments1.kolkode.in/",
            categories: ["love", "anniversary", "proposal"]
        },
        {
            id: "t2",
            name: "Vintage Scrapbook",
            price: "₹549",
            tag: "New",
            tagColor: "bg-secondary",
            description: "A nostalgic journey through photos with animated transitions, music, and custom messages.",
            image: "assets/love_story2_preview.png",
            preview: "https://wowmoments2.kolkode.in/",
            categories: ["love", "anniversary", "family", "friendship", "customized"]
        },
        {
            id: "t6",
            name: "Secret Passcode Birthday",
            price: "₹279",
            tag: "Interactive",
            tagColor: "bg-[#ff4d8d]",
            description: "A passcode-locked birthday surprise. Features an interactive cake with candles to blow out, a live age counter, and a beautiful handwritten letter.",
            image: "assets/love_story5_preview.png",
            preview: "https://wowmoments5.kolkode.in/",
            categories: ["love", "birthday", "customized"]
        },
        {
            id: "t7",
            name: "For Baba — Father's Day",
            price: "₹149",
            tag: "Special",
            tagColor: "bg-secondary",
            description: "A warm, nostalgic Father's Day page. Features a beautiful hand-drawn background, video memory, custom polaroid grid, and an interactive envelope letter reveal.",
            image: "assets/fathers_day_preview.png",
            preview: "https://fathersdaycard.kolkode.in/",
            categories: ["love", "family", "festival", "customized"]
        },
        {
            id: "t3",
            name: "Apology Gift",
            price: "₹149",
            tag: null,
            tagColor: "",
            description: "A touching, interactive website designed to express your heartfelt apologies and sweeten the healing.",
            image: "assets/apology_gift_preview.png",
            preview: "https://apologygift.kolkode.in/",
            categories: ["love", "friendship", "customized"]
        },
        {
            id: "t4",
            name: "A Surprise For You",
            price: "₹99",
            tag: "Cute",
            tagColor: "bg-[#ff4d8d]",
            description: "A sweet, playful interactive surprise card filled with custom animations and personalized notes.",
            image: "assets/love_story4_preview.png",
            preview: "https://wowmoments4.kolkode.in/",
            categories: ["love", "birthday", "friendship"]
        },
        {
            id: "t5",
            name: "A Love Letter",
            price: "₹99",
            tag: "Minimal",
            tagColor: "bg-secondary",
            description: "A beautifully styled, elegant digital stationery envelope and interactive love letter.",
            image: "assets/love_story3_preview.png",
            preview: "https://wowmoments3.kolkode.in/",
            categories: ["love", "proposal", "anniversary"]
        },
        {
            id: "t8",
            name: "Happy Anniversary Card",
            price: "₹129",
            tag: "New",
            tagColor: "bg-primary",
            description: "A beautiful Happy Anniversary digital card featuring a personalized photo and heartfelt message.",
            image: "assets/anniversary.png",
            preview: "https://wowmoments6.kolkode.in/",
            categories: ["love", "anniversary", "festival"]
        }
    ];

    if (grid) {
        let templates = DEFAULT_TEMPLATES;
        const TEMPLATES_CACHE_KEY = 'wow_templates_cache_v4';
        let currentCategory = 'all';

        function generateWALink(name, price) {
            const baseUrl = "https://wa.me/918609539322";
            const message = `Hello Wow Moments 👋\nI would like to order the ${name} template.\nPrice: ${price}\n\nPlease let me know the next steps.`;
            return `${baseUrl}?text=${encodeURIComponent(message)}`;
        }

        function getFallbackAsset(t) {
            const map = {
                't1': 'love_story_preview.png',
                't2': 'love_story2_preview.png',
                't3': 'apology_gift_preview.png',
                't4': 'love_story4_preview.png',
                't5': 'love_story3_preview.png',
                't6': 'love_story5_preview.png',
                't7': 'fathers_day_preview.png',
                't8': 'anniversary.png'
            };
            return map[t.id] || 'love_story_preview.png';
        }

        function renderTemplates(filteredList) {
            if (!grid) return;
            grid.innerHTML = '';
            if (!filteredList || filteredList.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 font-medium">No templates found in this category.</div>';
                return;
            }
            filteredList.forEach((t, idx) => {
                const card = document.createElement('div');
                card.className = "template-card glass-card rounded-[2rem] overflow-hidden flex flex-col p-2 group";
                
                let imageUrl = t.image;
                if (imageUrl && imageUrl.startsWith('/api/templates/')) {
                    imageUrl = `${API_BASE}${imageUrl}`;
                } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('assets/')) {
                    imageUrl = `assets/${imageUrl}`;
                } else if (!imageUrl) {
                    imageUrl = `assets/${getFallbackAsset(t)}`;
                }
                
                let priceHtml;
                if (t.discountPercent > 0 && t.originalPrice) {
                    priceHtml = `
                        <div class="flex flex-col items-end flex-shrink-0 ml-2">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs text-gray-400 line-through">${t.originalPrice}</span>
                                <span class="text-primary font-extrabold whitespace-nowrap text-lg">${t.price}</span>
                            </div>
                            <span class="inline-block text-[8px] font-black uppercase tracking-wider text-white bg-primary px-1.5 py-0.5 rounded-full mt-0.5">${t.discountPercent}% OFF</span>
                        </div>
                    `;
                } else {
                    priceHtml = `<span class="text-primary font-bold whitespace-nowrap ml-2">${t.price}</span>`;
                }

                const fallbackSrc = `assets/${getFallbackAsset(t)}`;

                card.innerHTML = `
                    <div class="relative overflow-hidden rounded-[1.8rem] bg-gray-100">
                        <img class="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-700" 
                             src="${imageUrl}" 
                             alt="${t.name}" 
                             loading="${idx < 2 ? 'eager' : 'lazy'}" 
                             decoding="async"
                             onerror="if(this.src !== '${fallbackSrc}' && !this.src.endsWith('${fallbackSrc}')){ this.src = '${fallbackSrc}'; }"
                             ${idx === 0 ? 'fetchpriority="high"' : ''}>
                        ${t.tag ? `<div class="absolute top-4 left-4 ${t.tagColor || 'bg-primary'} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">${t.tag}</div>` : ''}
                    </div>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-2xl brand-font leading-tight">${t.name}</h3>
                                ${priceHtml}
                            </div>
                            <p class="text-on-surface-variant text-sm mb-6">${t.description}</p>
                        </div>
                        ${t.preview ? `
                         <div class="flex gap-3">
                            <a href="${t.preview}" target="_blank" rel="noopener noreferrer" class="flex-1 py-3 md:py-4 rounded-2xl border-2 border-primary text-primary hover:bg-primary/5 font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">visibility</span> Preview
                            </a>
                            <a href="${generateWALink(t.name, t.price)}" target="_blank" rel="noopener noreferrer" class="btn-gradient flex-1 py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                                <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                            </a>
                        </div>
                        ` : `
                        <a href="${generateWALink(t.name, t.price)}" target="_blank" rel="noopener noreferrer" class="btn-gradient w-full py-3 md:py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 text-xs sm:text-sm">
                            <span class="material-symbols-outlined text-base sm:text-lg">chat</span> Order Now
                        </a>
                        `}
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Instant display for 0ms mobile and desktop initial page load
        let cachedTemplatesRaw = safeStorage.getItem(TEMPLATES_CACHE_KEY);
        if (cachedTemplatesRaw) {
            try {
                const parsed = JSON.parse(cachedTemplatesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    templates = parsed;
                }
            } catch (e) {}
        }
        // Render immediately on DOM load
        renderTemplates(templates);

        // Fetch fresh templates from API in background (stale-while-revalidate with retry)
        async function fetchTemplates(retryCount = 0) {
            try {
                const response = await fetch(`${API_BASE}/api/templates`);
                if (!response.ok) throw new Error('HTTP status ' + response.status);
                const freshTemplates = await response.json();
                
                if (Array.isArray(freshTemplates) && freshTemplates.length > 0) {
                    templates = freshTemplates;
                    const freshStr = JSON.stringify(freshTemplates);
                    safeStorage.setItem(TEMPLATES_CACHE_KEY, freshStr);
                    
                    if (currentCategory === 'all') {
                        renderTemplates(templates);
                    } else {
                        const filtered = templates.filter(t => t.categories && t.categories.includes(currentCategory));
                        renderTemplates(filtered.length > 0 ? filtered : templates);
                    }
                }
            } catch (err) {
                // If backend is sleeping, retry gracefully in background
                if (retryCount < 2) {
                    setTimeout(() => fetchTemplates(retryCount + 1), 3000);
                }
            }
        }

        // Trigger background revalidation
        fetchTemplates();

        // Category filter click listener
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                currentCategory = category;

                // Toggle active style classes
                categoryButtons.forEach(b => {
                    b.classList.remove('text-primary', 'bg-primary-container/20', 'border-primary/30');
                    b.classList.add('text-on-surface-variant');
                });
                btn.classList.add('text-primary', 'bg-primary-container/20', 'border-primary/30');
                btn.classList.remove('text-on-surface-variant');

                // Filter templates
                let filtered;
                if (category === 'all') {
                    filtered = templates;
                } else {
                    filtered = templates.filter(t => t.categories && t.categories.includes(category));
                }
                renderTemplates(filtered);

                // Smooth scroll to templates section
                const templatesSection = document.getElementById('templates');
                if (templatesSection) {
                    templatesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // View All Templates click listener
        const viewAllBtn = document.getElementById('view-all-templates');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                categoryButtons.forEach(b => {
                    if (b.getAttribute('data-category') === 'all') {
                        b.classList.add('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.remove('text-on-surface-variant');
                    } else {
                        b.classList.remove('text-primary', 'bg-primary-container/20', 'border-primary/30');
                        b.classList.add('text-on-surface-variant');
                    }
                });
                currentCategory = 'all';
                renderTemplates(templates);
                const templatesSection = document.getElementById('templates');
                if (templatesSection) {
                    templatesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    // ----------------------------------------------------------------
    // 3. IntersectionObserver Reveal Animations (Mobile-Friendly)
    // ----------------------------------------------------------------
    const revealElements = document.querySelectorAll('.reveal-anim');
    const observerOptions = { threshold: 0.01, rootMargin: '50px 0px 50px 0px' };
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    // Special progress bar animation for How it Works
                    if (entry.target.id === 'how-it-works') {
                        const progressBar = document.getElementById('progress-bar');
                        if (progressBar) {
                            progressBar.style.height = '100%';
                        }
                    }
                }
            });
        }, observerOptions);

        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }

    // Safety fallback: Ensure all content is revealed within 800ms on mobile devices
    setTimeout(() => {
        revealElements.forEach(el => el.classList.add('active'));
    }, 800);

    // ----------------------------------------------------------------
    // 4. Sticky Nav Transformation
    // ----------------------------------------------------------------
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('top-nav');
        if (!nav) return;
        if (window.scrollY > 50) {
            nav.classList.add('py-2', 'bg-surface/90');
            nav.classList.remove('py-4', 'bg-surface/60');
        } else {
            nav.classList.remove('py-2', 'bg-surface/90');
            nav.classList.add('py-4', 'bg-surface/60');
        }
    });

    // ----------------------------------------------------------------
    // 5. Mobile Menu Toggle Logic
    // ----------------------------------------------------------------
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    function openMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('translate-x-full');
        mobileMenu.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
    }

    function closeMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('translate-x-0');
        mobileMenu.classList.add('translate-x-full');
        document.body.classList.remove('overflow-hidden');
    }

    if (mobileMenuBtn && mobileMenu && mobileMenuClose) {
        mobileMenuBtn.addEventListener('click', openMobileMenu);
        mobileMenuClose.addEventListener('click', closeMobileMenu);
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    }

    // ----------------------------------------------------------------
    // 6. Sale Banner Popup
    // ----------------------------------------------------------------
    (async function initSaleBannerPopup() {
        const overlay    = document.getElementById('sale-popup-overlay');
        const closeBtn   = document.getElementById('sale-popup-close');
        const popupImg   = document.getElementById('sale-popup-img');
        const popupCap   = document.getElementById('sale-popup-caption');
        const popupCta   = document.getElementById('sale-popup-cta');

        if (!overlay || !closeBtn) return; // safety guard

        // Only show once per browser session
        if (sessionStorage.getItem('salePopupDismissed')) return;

        try {
            const res  = await fetch(`${API_BASE}/api/banner`);
            const data = await res.json();

            if (!data.active || !data.image) return; // no active banner

            // Populate popup content
            popupImg.src = data.image;
            popupImg.style.display = 'block';

            if (data.caption) {
                popupCap.textContent = data.caption;
                popupCap.style.display = 'block';
            } else {
                popupCap.style.display = 'none';
            }

            popupCta.textContent = data.ctaText || 'Shop Sale';
            popupCta.href        = data.ctaLink  || '#templates';

            // Show the popup with a short delay so the page can settle first
            setTimeout(() => {
                overlay.classList.add('visible');
                document.body.style.overflow = 'hidden'; // prevent scroll behind popup
            }, 700);

            // Close popup helper
            function closePopup() {
                overlay.classList.remove('visible');
                document.body.style.overflow = '';
                sessionStorage.setItem('salePopupDismissed', '1');
            }

            // Close button
            closeBtn.addEventListener('click', closePopup);

            // Click on dark backdrop (not on the card) also closes
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePopup();
            });

            // CTA click closes popup then navigates
            popupCta.addEventListener('click', () => {
                closePopup();
            });

            // Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closePopup();
            });

        } catch (err) {
            console.warn('Could not load sale banner:', err);
        }
    })();

    // ----------------------------------------------------------------
    // 7. Dynamic Reviews System (Carousel & Submission)
    // ----------------------------------------------------------------
    (async function initReviewsSystem() {
        const container = document.getElementById('reviews-container');
        const prevBtn = document.getElementById('reviews-prev');
        const nextBtn = document.getElementById('reviews-next');
        const writeBtn = document.getElementById('write-review-btn');
        const modalOverlay = document.getElementById('review-modal-overlay');
        const modalClose = document.getElementById('review-modal-close');
        const form = document.getElementById('public-review-form');
        const formError = document.getElementById('review-form-error');
        const formSuccess = document.getElementById('review-form-success');

        if (!container) return;

        // Render stars helper
        function renderStars(rating) {
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                const filled = i < rating;
                starsHtml += `<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' ${filled ? 1 : 0};">star</span>`;
            }
            return starsHtml;
        }

        // Render reviews list
        function renderReviewsList(reviews) {
            container.innerHTML = '';
            if (reviews.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500 font-medium w-full">No reviews yet. Be the first to write one!</div>`;
                if (prevBtn) prevBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
                return;
            }

            reviews.forEach(r => {
                const card = document.createElement('div');
                card.className = "flex-none w-80 glass-card review-card p-8 rounded-[2rem] flex flex-col";
                card.style.scrollSnapAlign = "start";

                // Avatar selection (image or initials fallback)
                let avatarHtml;
                if (r.avatar) {
                    avatarHtml = `<img class="w-12 h-12 rounded-full object-cover bg-gray-50 flex-shrink-0" src="${r.avatar}" alt="${r.name}">`;
                } else {
                    const initials = r.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    avatarHtml = `<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm tracking-wider uppercase flex-shrink-0">${initials}</div>`;
                }

                card.innerHTML = `
                    <div class="flex gap-1 text-yellow-500 mb-4 flex-shrink-0">
                        ${renderStars(r.rating)}
                    </div>
                    <p class="italic text-on-surface-variant mb-8 font-body-md flex-grow overflow-y-auto pr-1">"${r.comment}"</p>
                    <div class="mt-auto flex items-center gap-4 flex-shrink-0">
                        ${avatarHtml}
                        <div>
                            <p class="font-bold text-sm text-gray-800">${r.name}</p>
                            ${r.location ? `<p class="text-xs text-primary uppercase font-bold tracking-widest mt-0.5">${r.location}</p>` : ''}
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });

            updateArrows();
        }

        const DEFAULT_REVIEWS = [
            {
                id: "r1",
                name: "Rahul Verma",
                rating: 5,
                comment: "The anniversary website was the highlight of our 5th anniversary. My wife was in tears! The quality is just premium.",
                location: "Bengaluru",
                avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCv5hSotoC2bk7fYbnjPqkhFzxBERKm0GPfK9iiarIHfjOr6aWpmnoMAxm3WwHNw6Wrxxlfx-jxYffuybYm2mTd4ov_s0CshpOV8f8X6dQv3JXUCZrzJgffi3OTeVHshJ6BYqQIjj0FBKRv0b8KsKRLCcXm853_H8TDD8osNEdL21LPoTypkG9Kylj1BnDxQGA2cGm7tboXTR-mdwRgnEmi4NNBMI2jApBVD09SbyT9NZAhWoo9Bfu9gL-GwYxWSssNZFu_AAFEIw"
            },
            {
                id: "r2",
                name: "Sneha Kapoor",
                rating: 5,
                comment: "Ordered a digital scrapbook for my best friend's wedding. The animations were so fluid. It felt like a real book!",
                location: "Mumbai",
                avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuC9qmSupc_EC9P4oGYSY36BoTa2lfyTX6_sNnAsXpTBO6v1t0-mUVM_u8VARr08DBxgGR_CgmP4bT4d2EbUCB21oDTRULlFU_YTjAYVkuMVugWwU59bRNZwVSmcvmRJ4MYEv_bOiumhWPacksZqwrWI5qYvvxJBdlubwSkEHIGAIRW3GSqZ85X-hPbjoHEwteYbJiR0dNRokLQh65z-5AUZG0HcNbn11laiNGh1Z99RMzrY5G4ygcDCqkqTK-tKxiBUqOuXFXksRg"
            }
        ];

        const REVIEWS_CACHE_KEY = 'wow_reviews_cache_v4';
        let initialReviews = DEFAULT_REVIEWS;
        let cachedReviewsRaw = safeStorage.getItem(REVIEWS_CACHE_KEY);
        if (cachedReviewsRaw) {
            try {
                const parsed = JSON.parse(cachedReviewsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    initialReviews = parsed;
                }
            } catch (e) {}
        }
        renderReviewsList(initialReviews);

        // Fetch approved reviews (stale-while-revalidate)
        async function fetchReviews() {
            try {
                const res = await fetch(`${API_BASE}/api/reviews`);
                if (!res.ok) throw new Error();
                const freshReviews = await res.json();
                if (Array.isArray(freshReviews) && freshReviews.length > 0) {
                    const freshStr = JSON.stringify(freshReviews);
                    safeStorage.setItem(REVIEWS_CACHE_KEY, freshStr);
                    renderReviewsList(freshReviews);
                }
            } catch (err) {
                // Initial reviews are already rendered
            }
        }

        // Scroll functionality
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', () => {
                container.scrollBy({ left: -320, behavior: 'smooth' });
            });
            nextBtn.addEventListener('click', () => {
                container.scrollBy({ left: 320, behavior: 'smooth' });
            });

            container.addEventListener('scroll', updateArrows);
        }

        function updateArrows() {
            if (!prevBtn || !nextBtn) return;
            const scrollLeft = container.scrollLeft;
            const maxScroll = container.scrollWidth - container.clientWidth;
            
            prevBtn.disabled = scrollLeft <= 5;
            nextBtn.disabled = scrollLeft >= maxScroll - 5;
        }

        // Modal triggers
        if (writeBtn && modalOverlay && modalClose) {
            writeBtn.addEventListener('click', () => {
                modalOverlay.classList.add('visible');
                document.body.style.overflow = 'hidden';
                formError.classList.add('hidden');
                formSuccess.classList.add('hidden');
                form.reset();
            });

            const closeModal = () => {
                modalOverlay.classList.remove('visible');
                document.body.style.overflow = '';
            };

            modalClose.addEventListener('click', closeModal);
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modalOverlay.classList.contains('visible')) {
                    closeModal();
                }
            });
        }

        // Submit public review form
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                formError.classList.add('hidden');
                formSuccess.classList.add('hidden');

                const submitBtn = document.getElementById('review-form-submit');
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">sync</span> Submitting...`;

                const formData = new FormData(form);

                try {
                    const response = await fetch(`${API_BASE}/api/reviews`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();
                    if (response.ok) {
                        formSuccess.textContent = "Thank you! Your review has been submitted for admin approval.";
                        formSuccess.classList.remove('hidden');
                        form.reset();
                        setTimeout(() => {
                            modalOverlay.classList.remove('visible');
                            document.body.style.overflow = '';
                            fetchReviews(); // refetch reviews in case it's auto-approved
                        }, 2000);
                    } else {
                        formError.textContent = data.error || 'Failed to submit review';
                        formError.classList.remove('hidden');
                    }
                } catch (err) {
                    formError.textContent = 'Server error. Failed to submit review.';
                    formError.classList.remove('hidden');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        // Load reviews initially
        fetchReviews();

        // ─── Active Navigation Styling & Scrollspy ────────────────────────────────
        const desktopNavLinks = document.querySelectorAll('#top-nav a[href^="#"]');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        const bottomNavLinks = document.querySelectorAll('nav.fixed.bottom-0 a[href^="#"]');

        const sections = [
            { id: 'home', element: document.querySelector('section.hero-radial-glow') },
            { id: 'templates', element: document.getElementById('templates') },
            { id: 'how-it-works', element: document.getElementById('how-it-works') },
            { id: 'reviews', element: document.getElementById('reviews') },
            { id: 'faq', element: document.getElementById('faq') }
        ];

        function setActiveLink(sectionId) {
            // Desktop Navbar Links
            desktopNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';
                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "text-[#b90a5a] font-bold hover:opacity-80 transition-opacity";
                } else {
                    link.className = "text-on-surface-variant font-medium hover:text-[#b90a5a] transition-colors";
                }
            });

            // Mobile Overlay Menu Links
            mobileNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';
                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "mobile-nav-link text-2xl font-bold text-[#b90a5a] hover:opacity-80 transition-all active:scale-95";
                } else {
                    link.className = "mobile-nav-link text-2xl font-bold text-[#594046] hover:text-[#b90a5a] transition-colors active:scale-95";
                }
            });

            // Bottom Nav Bar Links
            bottomNavLinks.forEach(link => {
                const href = link.getAttribute('href');
                const isHome = href === '#' || href === '';

                if ((sectionId === 'home' && isHome) || href === `#${sectionId}`) {
                    link.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 transition-all duration-300";
                } else {
                    link.className = "flex flex-col items-center justify-center text-on-surface-variant transition-all duration-300";
                }
            });
        }

        // Setup click listeners
        desktopNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
            });
        });

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu) {
                    mobileMenu.classList.add('translate-x-full');
                }
            });
        });

        bottomNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                const sectionId = href === '#' || href === '' ? 'home' : href.replace('#', '');
                setActiveLink(sectionId);
            });
        });

        // Setup scrollspy listener
        window.addEventListener('scroll', () => {
            let currentSection = 'home';
            const scrollPos = window.scrollY + 120; // Offset for navbar

            sections.forEach(sec => {
                if (sec.element) {
                    const top = sec.element.getBoundingClientRect().top + window.scrollY;
                    if (scrollPos >= top - 20) {
                        currentSection = sec.id;
                    }
                }
            });

            // Handle bottom of page selection
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
                currentSection = 'faq';
            }

            setActiveLink(currentSection);
        });
    })();
});
