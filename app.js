;(() => {
    const app = document.getElementById('app')
    const nav = document.getElementById('nav')
    const year = document.getElementById('year')
    year.textContent = new Date().getFullYear()

    const state = {
        session: loadSession(),
        route: window.location.hash.slice(1) || '/',
        errors: {}
    }
    // Redirect unauthenticated users landing on root to /login
    if(!state.session && (state.route === '/' || state.route === '')){
        state.route = '/login'
        window.location.hash = state.route
    }

    function loadSession(){
        try{ return JSON.parse(localStorage.getItem('gc_fl_session')||'null') }catch{ return null }
    }
    function saveSession(session){ localStorage.setItem('gc_fl_session', JSON.stringify(session)) }
    function clearSession(){ localStorage.removeItem('gc_fl_session') }

    function setRoute(route){
        if(route === state.route) return
        state.route = route
        window.location.hash = route
        render()
    }

    window.addEventListener('hashchange', () => {
        state.route = window.location.hash.slice(1) || '/'
        if(!state.session && (state.route === '/' || state.route === '/dashboard')){
            state.route = '/login'
            window.location.hash = state.route
        }
        render()
    })

    // Mock API
    const api = {
        async signup({ name, email, password }){
            await delay(400)
            const users = loadUsers()
            if(users[email]) throw fieldError('email', 'Email already registered')
            users[email] = { name, email, password }
            saveUsers(users)
            return { user: { name, email }, token: makeToken(email) }
        },
        async login({ email, password }){
            await delay(350)
            const users = loadUsers()
            if(!users[email] || users[email].password !== password) throw fieldError('password', 'Invalid credentials')
            return { user: { name: users[email].name, email }, token: makeToken(email) }
        },
        async logout(){ await delay(150); }
    }

    function loadUsers(){ try{ return JSON.parse(localStorage.getItem('gc_fl_users')||'{}') }catch{ return {} } }
    function saveUsers(users){ localStorage.setItem('gc_fl_users', JSON.stringify(users)) }
    function makeToken(seed){ return btoa(`${seed}.${Date.now()}`) }
    function delay(ms){ return new Promise(r => setTimeout(r, ms)) }
    function fieldError(field, message){ const err = new Error(message); err.field = field; return err }

    function renderNav(){
        nav.innerHTML = ''
        const links = document.createElement('div')
        links.className = 'nav'

        const to = (href, label, variant='ghost') => {
            const b = document.createElement('button')
            b.className = `btn ${variant}`
            b.textContent = label
            b.addEventListener('click', () => setRoute(href))
            return b
        }

        if(state.session){
            links.append(
                to('/', 'Home'),
                to('/dashboard', 'Dashboard'),
            )
            const logoutBtn = to('/logout', 'Logout', 'primary')
            logoutBtn.addEventListener('click', async () => {
                await api.logout()
                state.session = null
                clearSession()
                setRoute('/login')
            })
            links.append(logoutBtn)
        } else {
            // Only show Sign up until authentication
            links.append(
                to('/signup', 'Sign up', 'primary'),
            )
        }

        nav.appendChild(links)
    }

    function render(){
        renderNav()
        app.innerHTML = ''
        const route = state.route
        // Guard routes for unauthenticated users
        if(!state.session && (route === '/' || route === '/dashboard')){
            setRoute('/login')
            return
        }

        if(route === '/' || route === ''){
            app.appendChild(viewHome())
            return
        }
        if(route === '/login'){
            app.appendChild(viewLogin())
            return
        }
        if(route === '/signup'){
            app.appendChild(viewSignup())
            return
        }
        if(route === '/dashboard'){
            app.appendChild(viewDashboard())
            return
        }
        if(route === '/result'){
            app.appendChild(viewResult())
            return
        }
        if(route === '/privacy'){
            app.appendChild(viewPrivacy())
            return
        }
        app.appendChild(notFound())
    }

    function viewHome(){
        const wrap = document.createElement('div')
        const hero = document.createElement('section')
        hero.className = 'hero'
        hero.innerHTML = `
            <div>
                <div class="eyebrow">Federated Learning · Privacy-Preserving AI</div>
                <h1>Federated Intelligence for Gastric Cancer Detection</h1>
                <p class="lede">Accurate. Secure. Federated. Revolutionizing gastric cancer diagnosis through privacy-preserving AI.</p>
                <div style="display:flex; gap:10px; margin-top:16px;">
                    <button class="btn primary" id="cta-start">Upload Image</button>
                    <button class="btn ghost" id="cta-learn">How this works</button>
                </div>
            </div>
            <div class="card">
                <canvas id="spark" width="520" height="280" style="width:100%; height:auto; border-radius:12px; background: radial-gradient(600px 300px at 20% 10%, rgba(91,208,255,0.15), transparent), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2));"></canvas>
                <div class="help" style="margin-top:10px">Synthetic metric preview</div>
            </div>
        `

        const upload = document.createElement('section')
        upload.className = 'card'
        upload.id = 'upload-section'
        upload.innerHTML = `
            <h2>Try the prototype</h2>
            <p class="help">Select an endoscopy image (JPG/PNG). The image stays in your browser. We'll show a simulated risk score to illustrate the UX.</p>
            <div class="divider"></div>
            <form id="inference-form" novalidate>
                <div class="field">
                    <label class="label" for="img-input">Image</label>
                    <input class="input" id="img-input" type="file" accept="image/*" required />
                    <div class="error" data-error-for="image"></div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start; margin-top:14px;">
                    <div>
                        <img id="img-preview" alt="Preview" style="max-width:100%; border-radius:12px; display:none; border:1px solid rgba(255,255,255,0.08)" />
                    </div>
                    <div>
                        <button class="btn primary" type="submit" id="run-btn">Run analysis</button>
                        <div id="result" style="margin-top:12px;">
                            <div class="help">No result yet.</div>
                        </div>
                    </div>
                </div>
            </form>
        `

        wrap.append(hero, upload)
        setTimeout(drawSpark, 50)

        hero.querySelector('#cta-start').addEventListener('click', () => {
            document.getElementById('img-input')?.focus()
            document.getElementById('img-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        hero.querySelector('#cta-learn').addEventListener('click', () => window.alert('This demo does not train or send data. It simulates a model response locally to show the intended UX.'))

        const form = upload.querySelector('#inference-form')
        const fileInput = upload.querySelector('#img-input')
        const preview = upload.querySelector('#img-preview')
        const result = upload.querySelector('#result')
        fileInput.addEventListener('change', () => handlePreview(fileInput, preview))
        form.addEventListener('submit', async (e) => {
            e.preventDefault()
            clearErrors(form)
            if(!fileInput.files || fileInput.files.length === 0){
                showErrors(form, { image: 'Please select an image' })
                return
            }
            setFormBusy(form, true)
            result.innerHTML = '<div class="help">Running analysis…</div>'
            try{
                const file = fileInput.files[0]
                const imageDataUrl = await toDataUrl(file)
                const inference = await runMockInference(file)
                // Persist last result for result page
                const payload = { imageDataUrl, inference }
                sessionStorage.setItem('gc_last_result', JSON.stringify(payload))
                setRoute('/result')
            } finally {
                setFormBusy(form, false)
            }
        })

        return wrap
    }

    function viewLogin(){
        const section = document.createElement('section')
        section.className = 'auth'
        section.innerHTML = `
            <div class="auth-panel">
                <h2>Log in</h2>
                <form id="login-form" novalidate>
                    <div class="field">
                        <label class="label" for="login-email">Email</label>
                        <input class="input" id="login-email" type="email" autocomplete="email" required placeholder="you@hospital.org" />
                        <div class="error" data-error-for="email"></div>
                    </div>
                    <div class="field">
                        <label class="label" for="login-password">Password</label>
                        <input class="input" id="login-password" type="password" autocomplete="current-password" required placeholder="••••••••" />
                        <div class="error" data-error-for="password"></div>
                    </div>
                    <div class="divider"></div>
                    <button class="btn primary" type="submit">Log in</button>
                    <span class="help" style="margin-left:10px">No account? <a href="#/signup">Sign up</a></span>
                </form>
            </div>
            <div class="card">
                <h3>Secure Collaboration</h3>
                <p class="help">Participate in global model training without exposing patient-level data.</p>
            </div>
        `

        const form = section.querySelector('#login-form')
        form.addEventListener('submit', async (e) => {
            e.preventDefault()
            clearErrors(form)
            const email = form.querySelector('#login-email').value.trim()
            const password = form.querySelector('#login-password').value
            const errors = {}
            if(!email) errors.email = 'Email is required'
            if(!password) errors.password = 'Password is required'
            if(Object.keys(errors).length){ return showErrors(form, errors) }
            try{
                setFormBusy(form, true)
                const res = await api.login({ email, password })
                state.session = res
                saveSession(res)
                setRoute('/')
            }catch(err){
                if(err.field){ showErrors(form, { [err.field]: err.message }) }
                else showErrors(form, { password: 'Login failed. Try again.' })
            }finally{
                setFormBusy(form, false)
            }
        })
        return section
    }

    function viewSignup(){
        const section = document.createElement('section')
        section.className = 'auth'
        section.innerHTML = `
            <div class="auth-panel">
                <h2>Create account</h2>
                <form id="signup-form" novalidate>
                    <div class="field">
                        <label class="label" for="signup-name">Full name</label>
                        <input class="input" id="signup-name" type="text" autocomplete="name" required placeholder="Dr. Jane Doe" />
                        <div class="error" data-error-for="name"></div>
                    </div>
                    <div class="field">
                        <label class="label" for="signup-email">Email</label>
                        <input class="input" id="signup-email" type="email" autocomplete="email" required placeholder="you@hospital.org" />
                        <div class="error" data-error-for="email"></div>
                    </div>
                    <div class="field">
                        <label class="label" for="signup-password">Password</label>
                        <input class="input" id="signup-password" type="password" autocomplete="new-password" required placeholder="At least 8 characters" />
                        <div class="error" data-error-for="password"></div>
                    </div>
                    <div class="field">
                        <label class="label" for="signup-confirm">Confirm password</label>
                        <input class="input" id="signup-confirm" type="password" autocomplete="new-password" required placeholder="Re-enter password" />
                        <div class="error" data-error-for="confirm"></div>
                    </div>
                    <div class="divider"></div>
                    <button class="btn primary" type="submit">Create account</button>
                    <span class="help" style="margin-left:10px">Already have an account? <a href="#/login">Log in</a></span>
                </form>
            </div>
            <div class="card">
                <h3>Your privacy, our priority</h3>
                <p class="help">Your health deserves precision — and your privacy deserves protection.</p>
            </div>
        `

        const form = section.querySelector('#signup-form')
        form.addEventListener('submit', async (e) => {
            e.preventDefault()
            clearErrors(form)
            const name = form.querySelector('#signup-name').value.trim()
            const email = form.querySelector('#signup-email').value.trim()
            const password = form.querySelector('#signup-password').value
            const confirm = form.querySelector('#signup-confirm').value
            const errors = {}
            if(!name) errors.name = 'Name is required'
            if(!email) errors.email = 'Email is required'
            if(password.length < 8) errors.password = 'Use at least 8 characters'
            if(confirm !== password) errors.confirm = 'Passwords do not match'
            if(Object.keys(errors).length){ return showErrors(form, errors) }
            try{
                setFormBusy(form, true)
                const res = await api.signup({ name, email, password })
                state.session = res
                saveSession(res)
                setRoute('/dashboard')
            }catch(err){
                if(err.field){ showErrors(form, { [err.field]: err.message }) }
                else showErrors(form, { email: 'Signup failed. Try again.' })
            }finally{
                setFormBusy(form, false)
            }
        })
        return section
    }

    function viewDashboard(){
        if(!state.session){ setRoute('/login'); return document.createElement('div') }
        const s = document.createElement('section')
        s.className = 'card'
        s.innerHTML = `
            <h2>Welcome, ${state.session.user.name}</h2>
            <p class="help">This is a demo dashboard. Connect your real FL backend to populate rounds and metrics.</p>
            <div class="divider"></div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
                <div class="feature"><h3>Global rounds</h3><p>128</p></div>
                <div class="feature"><h3>Participating nodes</h3><p>9</p></div>
                <div class="feature"><h3>Last AUC</h3><p>0.91</p></div>
            </div>
        `
        return s
    }

    function viewPrivacy(){
        const s = document.createElement('section')
        s.className = 'card'
        s.innerHTML = `
            <h2>Privacy</h2>
            <p class="help">No real data is processed in this demo. All authentication is local-only.</p>
        `
        return s
    }

    function viewResult(){
        const raw = sessionStorage.getItem('gc_last_result')
        if(!raw){
            const s = document.createElement('section')
            s.className = 'card'
            s.innerHTML = `
                <h2>No result available</h2>
                <p class="help">Please upload an image on the home page to run analysis.</p>
                <div class="divider"></div>
                <button class="btn" id="back-home">Go to upload</button>
            `
            s.querySelector('#back-home').addEventListener('click', () => setRoute('/'))
            return s
        }
        let data
        try{ data = JSON.parse(raw) }catch{ data = null }
        if(!data || !data.imageDataUrl || !data.inference){
            sessionStorage.removeItem('gc_last_result')
            return notFound()
        }

        const { imageDataUrl, inference } = data
        const isCancerous = inference.label === 'cancerous'
        const confidencePct = Math.round(inference.confidence * 100)

        const s = document.createElement('section')
        s.className = 'card'

        // If confidence > 90% and cancerous, present image left and details right
        if(isCancerous && inference.confidence >= 0.90){
            s.innerHTML = `
                <h2>Result</h2>
                <div class="divider"></div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start;">
                    <div style="position:relative;">
                        <img src="${imageDataUrl}" alt="Uploaded" style="max-width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.08)" />
                        <div style="position:absolute; left:12px; top:12px; padding:6px 10px; border-radius:8px; background:rgba(255,0,0,0.85); color:white; font-weight:600;">
                            Gastric cancer
                        </div>
                    </div>
                    <div>
                        <div class="feature">
                            <h3>Image is cancerous</h3>
                            <p>Assumed accuracy: ${confidencePct}%</p>
                        </div>
                        <div class="feature" style="margin-top:10px;">
                            <h3>Recommendations</h3>
                            <ul id="rec-list" style="margin-top:6px; padding-left:18px;"></ul>
                        </div>
                        <div class="feature" style="margin-top:10px;">
                            <h3>Consult specialists</h3>
                            <div id="doc-list" style="display:grid; gap:8px; margin-top:8px;"></div>
                        </div>
                        <div class="help" style="margin-top:8px">This is a simulated result for UI demonstration only.</div>
                        <div class="divider"></div>
                        <button class="btn" id="try-again">Analyze another image</button>
                    </div>
                </div>
            `
        } else {
            const verdict = isCancerous ? 'Image is cancerous' : 'Image is non-cancerous'
            s.innerHTML = `
                <h2>Result</h2>
                <div class="divider"></div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start;">
                    <div>
                        <img src="${imageDataUrl}" alt="Uploaded" style="max-width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.08)" />
                    </div>
                    <div>
                        <div class="feature">
                            <h3>${verdict}</h3>
                            <p>Assumed accuracy: ${confidencePct}%</p>
                        </div>
                        <div class="feature" style="margin-top:10px;">
                            <h3>Recommendations</h3>
                            <ul id="rec-list" style="margin-top:6px; padding-left:18px;"></ul>
                        </div>
                        <div class="feature" style="margin-top:10px;">
                            <h3>Consult specialists</h3>
                            <div id="doc-list" style="display:grid; gap:8px; margin-top:8px;"></div>
                        </div>
                        <div class="help" style="margin-top:8px">This is a simulated result for UI demonstration only.</div>
                        <div class="divider"></div>
                        <button class="btn" id="try-again">Analyze another image</button>
                    </div>
                </div>
            `
        }
        s.querySelector('#try-again')?.addEventListener('click', () => {
            sessionStorage.removeItem('gc_last_result')
            setRoute('/')
        })
        // Populate right-side lists
        const list = s.querySelector('#rec-list')
        if(list){
            const items = buildRecommendations(isCancerous, inference.confidence)
            items.forEach(txt => {
                const li = document.createElement('li')
                li.textContent = txt
                list.appendChild(li)
            })
        }
        const docWrap = s.querySelector('#doc-list')
        if(docWrap){
            getDummyDoctors().forEach(doc => {
                const card = document.createElement('div')
                card.className = 'feature'
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div>
                            <strong>${doc.name}</strong>
                            <div class="help">${doc.title} · ${doc.org}</div>
                        </div>
                        <div>
                            <a class="btn" href="mailto:${doc.email}">Email</a>
                            <a class="btn ghost" href="tel:${doc.phone}">Call</a>
                        </div>
                    </div>
                `
                docWrap.appendChild(card)
            })
        }
        return s
    }

    function notFound(){
        const s = document.createElement('section')
        s.className = 'card'
        s.innerHTML = `<h2>404</h2><p class="help">Page not found.</p>`
        return s
    }

    function clearErrors(form){
        form.querySelectorAll('.error').forEach(el => el.textContent = '')
    }
    function showErrors(form, map){
        Object.entries(map).forEach(([field, message]) => {
            const target = form.querySelector(`.error[data-error-for="${field}"]`)
            if(target) target.textContent = message
        })
    }
    function setFormBusy(form, busy){
        form.querySelectorAll('input,button').forEach(el => el.disabled = busy)
    }

    function drawSpark(){
        const canvas = document.getElementById('spark')
        if(!canvas) return
        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
        const cssW = canvas.width
        const cssH = canvas.height
        // Scale for HiDPI displays while preserving CSS size
        canvas.style.width = '100%'
        canvas.style.height = 'auto'
        canvas.width = cssW * dpr
        canvas.height = cssH * dpr

        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        const w = cssW
        const h = cssH

        // Grid background
        function drawGrid(){
            ctx.save()
            ctx.clearRect(0,0,w,h)
            const bgGrad = ctx.createLinearGradient(0,0,0,h)
            bgGrad.addColorStop(0, 'rgba(255,255,255,0.03)')
            bgGrad.addColorStop(1, 'rgba(0,0,0,0.10)')
            ctx.fillStyle = bgGrad
            ctx.fillRect(0,0,w,h)

            ctx.strokeStyle = 'rgba(255,255,255,0.08)'
            ctx.lineWidth = 1
            const rows = 5
            const cols = 10
            for(let i=1;i<rows;i++){
                const y = (i/rows)*h
                ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke()
            }
            for(let i=1;i<cols;i++){
                const x = (i/cols)*w
                ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke()
            }
            ctx.restore()
        }

        // Deterministic pseudo-random
        function prng(seed){
            let s = seed >>> 0
            return () => {
                s = (s * 1664525 + 1013904223) >>> 0
                return (s & 0xffff) / 0xffff
            }
        }
        const rand = prng(42)

        // Generate two synthetic series: decreasing loss and increasing AUC
        const steps = 80
        const loss = []
        const auc = []
        let l = 1.0
        let a = 0.55
        for(let i=0;i<steps;i++){
            l -= (0.9 - 0.1*rand())/steps // trend down
            a += (0.95 - a) * 0.08 + (rand()-0.5)*0.01 // trend up
            loss.push(Math.max(0.08, Math.min(1, l + (rand()-0.5)*0.02)))
            auc.push(Math.max(0.5, Math.min(0.98, a + (rand()-0.5)*0.01)))
        }

        // Mapping helpers
        const pad = { l: 36, r: 12, t: 16, b: 26 }
        const xAt = i => pad.l + (i/(steps-1)) * (w - pad.l - pad.r)
        const yLoss = v => pad.t + (1 - (v-0)/(1.0-0)) * (h - pad.t - pad.b)
        const yAuc = v => pad.t + (1 - (v-0.5)/(1.0-0.5)) * (h - pad.t - pad.b)

        let t = 0 // animation progress 0..1
        const duration = 750
        let start = null

        function draw(){
            drawGrid()
            // Axes labels
            ctx.save()
            ctx.fillStyle = 'rgba(255,255,255,0.55)'
            ctx.font = '12px Inter, system-ui, sans-serif'
            ctx.fillText('Loss', pad.l, pad.t - 4)
            ctx.fillText('AUC', w - 60, pad.t - 4)
            ctx.restore()

            // Compute visible count based on t
            const count = Math.max(2, Math.floor(steps * t))

            // Draw LOSS with gradient area
            const gradLoss = ctx.createLinearGradient(0, pad.t, 0, h - pad.b)
            gradLoss.addColorStop(0, 'rgba(255,107,107,0.35)')
            gradLoss.addColorStop(1, 'rgba(255,107,107,0.05)')

            ctx.beginPath()
            for(let i=0;i<count;i++){
                const x = xAt(i), y = yLoss(loss[i])
                i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y)
            }
            // Stroke
            ctx.strokeStyle = 'rgba(255,107,107,0.9)'
            ctx.lineWidth = 2
            ctx.stroke()
            // Area fill
            ctx.lineTo(xAt(count-1), h - pad.b)
            ctx.lineTo(xAt(0), h - pad.b)
            ctx.closePath()
            ctx.fillStyle = gradLoss
            ctx.fill()

            // Draw AUC line
            const gradAuc = ctx.createLinearGradient(0,0,w,0)
            gradAuc.addColorStop(0, 'rgba(91,208,255,1)')
            gradAuc.addColorStop(1, 'rgba(124,245,161,1)')
            ctx.beginPath()
            for(let i=0;i<count;i++){
                const x = xAt(i), y = yAuc(auc[i])
                i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y)
            }
            ctx.strokeStyle = gradAuc
            ctx.lineWidth = 2.5
            ctx.shadowColor = 'rgba(0,0,0,0.35)'
            ctx.shadowBlur = 6
            ctx.stroke()
            ctx.shadowBlur = 0

            // End caps (points)
            const lastX = xAt(count-1)
            const lastY = yAuc(auc[count-1])
            ctx.fillStyle = 'rgba(124,245,161,1)'
            ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI*2); ctx.fill()

            // Legend
            ctx.save()
            ctx.fillStyle = 'rgba(255,255,255,0.75)'
            ctx.font = '12px Inter, system-ui, sans-serif'
            ctx.fillText('Synthetic metrics (demo)', pad.l, h - 6)
            ctx.restore()
        }

        function step(ts){
            if(start === null) start = ts
            const elapsed = ts - start
            t = Math.min(1, elapsed / duration)
            draw()
            if(t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }

    // Helpers
    async function toDataUrl(file){
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    function handlePreview(fileInput, imgEl){
        const file = fileInput.files && fileInput.files[0]
        if(!file){ imgEl.style.display = 'none'; imgEl.src = ''; return }
        const url = URL.createObjectURL(file)
        imgEl.src = url
        imgEl.style.display = 'block'
        imgEl.onload = () => URL.revokeObjectURL(url)
    }

    // Simulated inference producing label and confidence
    async function runMockInference(file){
        // Simulate processing delay
        await delay(600)
        // Use file size and a deterministic hash to make a stable-looking score per image
        const size = file.size || 1
        const name = file.name || 'unnamed'
        let hash = 0
        for(let i=0;i<name.length;i++) hash = ((hash<<5)-hash) + name.charCodeAt(i)
        const base = Math.abs(hash % 1000) / 1000
        let confidence = 0.9 + ((size % 1000) / 1000) * 0.09 // 0.90 .. 0.99
        confidence = Math.min(0.99, Math.max(0.90, confidence))
        const label = confidence > 0.6 ? 'cancerous' : 'non-cancerous'
        return { label, confidence }
    }

    function buildRecommendations(isCancerous, confidence){
        const pct = Math.round(confidence * 100)
        if(isCancerous){
            if(confidence >= 0.95){
                return [
                    `Urgent referral to gastroenterology for confirmatory endoscopy/biopsy (confidence ${pct}%).`,
                    'Document clinical symptoms and risk factors to aid triage.',
                    'Do not rely solely on AI; confirm with clinical evaluation.'
                ]
            }
            return [
                `Refer to gastroenterology for diagnostic confirmation (confidence ${pct}%).`,
                'Consider additional imaging views if available to improve assessment.',
                'Discuss findings with the patient and plan timely follow-up.'
            ]
        }
        if(confidence >= 0.95){
            return [
                `No immediate red flags detected (confidence ${pct}%).`,
                'Continue routine screening per local guidelines.',
                'Consult a clinician if symptoms persist or worsen.'
            ]
        }
        return [
            `Low likelihood detected (confidence ${pct}%).`,
            'If image quality is suboptimal, consider re-imaging for clarity.',
            'Monitor symptoms; seek medical advice if concerns arise.'
        ]
    }

    function getDummyDoctors(){
        return [
            { name: 'Dr. Aisha Rahman', title: 'Gastroenterologist', org: 'City Medical Center', email: 'a.rahman@example.org', phone: '+1-555-201-1100' },
            { name: 'Dr. Kenji Nakamura', title: 'GI Oncologist', org: 'Regional Cancer Institute', email: 'k.nakamura@example.org', phone: '+1-555-201-2233' },
            { name: 'Dr. Maria Gomez', title: 'Endoscopy Specialist', org: 'St. Mary Hospital', email: 'm.gomez@example.org', phone: '+1-555-201-3344' }
        ]
    }

    render()
})()


