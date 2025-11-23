/* Script de autenticación y control de sesión
   - Guarda credenciales de admin en localStorage (por defecto admin/admin123)
   - Maneja login, logout y redirecciones entre Login.html e Index.html
   - También expone funciones para actualizar credenciales desde el panel admin
*/

(function(){
	const DEFAULT_USER = 'admin';
	const DEFAULT_PASS = 'admin123';

	// Server-side authentication helpers (session)
	async function apiLogin(user, pass){
		const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ user, pass }) });
		if(!res.ok) throw new Error('Invalid credentials');
		return res.json();
	}

	async function apiLogout(){
		await fetch('/api/logout', { method: 'POST' });
		// redirect to login
		window.location = 'Login.html';
	}

	async function getSession(){
		const res = await fetch('/api/session');
		if(!res.ok) return { authenticated: false };
		return res.json();
	}

	function initLoginPage(){
		const form = document.getElementById('loginForm');
		if(!form) return;
		const err = document.getElementById('loginError');

		form.addEventListener('submit', async function(e){
			e.preventDefault();
			const u = document.getElementById('username').value.trim();
			const p = document.getElementById('password').value;
			try{
				await apiLogin(u,p);
				window.location = 'Index.html';
			}catch(_){
				if(err){ err.style.display = 'block'; err.textContent = 'Usuario o contraseña incorrectos.' }
			}
		});

		// Si ya estamos autenticados, enviar a Index
		getSession().then(s => { if(s && s.authenticated) window.location = 'Index.html'; }).catch(()=>{});
	}

	async function initIndexPage(){
		// Si no está autenticado, ir a Login (check server session)
		const sess = await getSession();
		if(!sess || !sess.authenticated){ window.location = 'Login.html'; return; }

		// Mostrar información de usuario y conectar logout
		const info = document.getElementById('user-info');
		const logoutBtn = document.getElementById('logoutBtn');
		const sessionUser = sess.user || '';

		if(info) info.textContent = 'Conectado como: ' + sessionUser;
		if(logoutBtn){
			logoutBtn.classList.remove('hidden');
			logoutBtn.addEventListener('click', function(){ apiLogout() });
		}

		// Mostrar sección de inventario si existe
		const inv = document.getElementById('inventory-section');
		if(inv) inv.classList.remove('hidden');

		// Manejar actualización de credenciales desde el adminForm (server-side)
		const adminForm = document.getElementById('adminForm');
		if(adminForm){
			adminForm.addEventListener('submit', async function(e){
				e.preventDefault();
				const currentUser = document.getElementById('currentUser').value.trim();
				const currentPass = document.getElementById('currentPass').value;
				const newUser = document.getElementById('newUser').value.trim();
				const newPass = document.getElementById('newPass').value;

				const msgEl = document.createElement('p');
				msgEl.className = 'muted small-info';
				try{
					const res = await fetch('/api/change-credentials', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ currentUser, currentPass, newUser, newPass }) });
					const data = await res.json();
					if(res.ok){
						msgEl.textContent = 'Credenciales actualizadas. Cierre sesión e ingrese con las nuevas credenciales.';
					} else {
						msgEl.style.color = 'var(--danger)';
						msgEl.textContent = data && data.error ? data.error : 'Error al actualizar credenciales.';
					}
				}catch(err){
					msgEl.style.color = 'var(--danger)';
					msgEl.textContent = 'Error de conexión al servidor.';
				}
				adminForm.parentNode.insertBefore(msgEl, adminForm.nextSibling);
			});
		}


		// Modal + add product handling
		const addForm = document.getElementById('addForm');
		const addBtn = document.getElementById('addProductBtn');
		const modalOverlay = document.getElementById('modalOverlay');
		const modalClose = document.getElementById('modalClose');
		const cancelModal = document.getElementById('cancelModal');


		let editingId = null;
		let currentImageData = null;

		function openModal(prefill){
			if(!modalOverlay) return;
			modalOverlay.classList.add('open');
			modalOverlay.setAttribute('aria-hidden','false');
			if(prefill){
				editingId = prefill.id;
				document.getElementById('nombre').value = prefill.nombre || '';
				document.getElementById('marca').value = prefill.marca || '';
				document.getElementById('modelo').value = prefill.modelo || '';
				document.getElementById('precio').value = prefill.precio || 0;
				document.getElementById('cantidad').value = prefill.cantidad || 0;
				currentImageData = prefill.imageData || null;
				const prev = document.getElementById('imagePreview'); if(prev) prev.src = currentImageData || '';
			} else {
				editingId = null;
				currentImageData = null;
				const prev = document.getElementById('imagePreview'); if(prev) prev.src = '';
			}
			const first = document.getElementById('nombre'); if(first) first.focus();
		}

		function closeModal(){
			if(!modalOverlay) return;
			modalOverlay.classList.remove('open');
			modalOverlay.setAttribute('aria-hidden','true');
			if(addForm) addForm.reset();
			editingId = null; currentImageData = null;
			const prev = document.getElementById('imagePreview'); if(prev) prev.src = '';
		}

		if(addBtn) addBtn.addEventListener('click', function(){ openModal(); });
		if(modalClose) modalClose.addEventListener('click', closeModal);
		if(cancelModal) cancelModal.addEventListener('click', closeModal);

		// close when clicking overlay outside modal
		if(modalOverlay){
			modalOverlay.addEventListener('click', function(e){
				if(e.target === modalOverlay) closeModal();
			});
		}


		// helper: upload image file to server, return URL or throw
		async function uploadImageToServer(file){
			try{
				const fd = new FormData();
				fd.append('image', file);
				const res = await fetch('/upload-image', { method: 'POST', body: fd });
				if(!res.ok) throw new Error('Upload failed');
				const data = await res.json();
				if(data && data.imageUrl) return data.imageUrl;
				throw new Error('No imageUrl in response');
			}catch(err){
				console.warn('Upload failed, will fallback to dataURL', err);
				throw err;
			}
		}

		async function deleteImageOnServer(imageUrl){
			try{
				const res = await fetch('/delete-image', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imageUrl })
				});
				if(!res.ok) throw new Error('Delete failed');
				return true;
			}catch(err){
				console.warn('Could not delete image on server', err);
				return false;
			}
		}

		// handle image input and preview (tries server upload, fallback to dataURL)
		const imageInput = document.getElementById('imageInput');
		const imagePreview = document.getElementById('imagePreview');
		if(imageInput){
			imageInput.addEventListener('change', async function(e){
				const f = (e.target.files && e.target.files[0]);
				if(!f){ currentImageData = null; if(imagePreview) imagePreview.src = ''; return; }
				// try upload to server
				try{
					const url = await uploadImageToServer(f);
					currentImageData = url;
					if(imagePreview) imagePreview.src = url;
				}catch(_){
					// fallback: dataURL
					const reader = new FileReader();
					reader.onload = function(ev){ currentImageData = ev.target.result; if(imagePreview) imagePreview.src = currentImageData; };
					reader.readAsDataURL(f);
				}
			});
		}

		if(addForm){
			addForm.addEventListener('submit', async function(e){
				e.preventDefault();
				const nombre = document.getElementById('nombre').value.trim();
				const marca = document.getElementById('marca').value.trim();
				const modelo = document.getElementById('modelo').value.trim();
				const precio = parseFloat(document.getElementById('precio').value) || 0;
				const cantidad = parseInt(document.getElementById('cantidad').value) || 0;

				if(!nombre) return alert('Nombre requerido');

				// If user selected a file and currentImageData is not server URL yet, attempt upload
				const file = (imageInput && imageInput.files && imageInput.files[0]) ? imageInput.files[0] : null;
				if(file){
					try{
						const url = await uploadImageToServer(file);
						currentImageData = url;
					}catch(err){
						// If upload fails, trust the FileReader fallback already set currentImageData from change handler
					}
				}

				const items = JSON.parse(localStorage.getItem('items') || '[]');
				if(editingId){
					// update existing
					const idx = items.findIndex(i=>i.id===editingId);
					if(idx!==-1){
						const previousImage = items[idx].imageData || null;
						items[idx].nombre = nombre;
						items[idx].marca = marca;
						items[idx].modelo = modelo;
						items[idx].precio = precio;
						items[idx].cantidad = cantidad;
						if(currentImageData) items[idx].imageData = currentImageData;
						// if previous image was hosted on server and different, request deletion
						if(previousImage && previousImage.startsWith('/ImgProductos/') && previousImage !== items[idx].imageData){
							// attempt delete, don't block on failure
							deleteImageOnServer(previousImage).then(()=>{/*deleted*/}).catch(()=>{/*ignore*/});
						}
					}
				} else {
					items.push({id:Date.now(), nombre, marca, modelo, precio, cantidad, imageData: currentImageData || null});
				}
				localStorage.setItem('items', JSON.stringify(items));
				renderTable();
				closeModal();
			});
		}

		// Search handling
		const searchInput = document.getElementById('search');
		if(searchInput){
			searchInput.addEventListener('input', function(){
				renderTable(this.value.trim());
			});
		}

		renderTable();
	}

	function renderTable(filter){
		const container = document.getElementById('tableContainer');
		if(!container) return;
		const q = (filter || '').toLowerCase();
		let items = JSON.parse(localStorage.getItem('items') || '[]');
		if(q){
			items = items.filter(it => {
				return (it.nombre || '').toLowerCase().includes(q) ||
					   (it.marca || '').toLowerCase().includes(q) ||
					   (it.modelo || '').toLowerCase().includes(q);
			});
		}

		if(items.length === 0){
			container.innerHTML = '<div class="empty-state">No hay productos registrados.</div>';
			return;
		}

		let html = '<table><thead><tr><th>Imagen</th><th>Nombre</th><th>Marca</th><th>Modelo</th><th>Precio</th><th>Cantidad</th><th>Acciones</th></tr></thead><tbody>';
		items.forEach(it => {
			const imgSrc = it.imageData ? it.imageData : 'Img/placeholder.png';
			html += `<tr data-id="${it.id}">`+
				`<td><img class="thumb" src="${imgSrc}" alt="${escapeHtml(it.nombre)}" /></td>`+
				`<td>${escapeHtml(it.nombre)}</td>`+
				`<td>${escapeHtml(it.marca)}</td>`+
				`<td>${escapeHtml(it.modelo)}</td>`+
				`<td>$${Number(it.precio).toFixed(2)}</td>`+
				`<td>${it.cantidad}</td>`+
				`<td class="row-actions">`+
					`<button class="edit">Editar</button>`+
					`<button class="delete">Eliminar</button>`+
					`<button class="export-img">Exportar imagen</button>`+
				`</td>`+
			`</tr>`;
		});
		html += '</tbody></table>';
		container.innerHTML = html;

		// Attach actions
		container.querySelectorAll('.delete').forEach(btn => {
			btn.addEventListener('click', function(){
				const tr = this.closest('tr');
				const id = Number(tr.getAttribute('data-id'));
				const items = JSON.parse(localStorage.getItem('items') || '[]').filter(i=>i.id!==id);
				localStorage.setItem('items', JSON.stringify(items));
				const searchVal = (document.getElementById('search') || {}).value || '';
				renderTable(searchVal);
			});
		});

		container.querySelectorAll('.edit').forEach(btn => {
			btn.addEventListener('click', function(){
				const tr = this.closest('tr');
				const id = Number(tr.getAttribute('data-id'));
				const items = JSON.parse(localStorage.getItem('items') || '[]');
				const item = items.find(i=>i.id===id);
				if(!item) return;
				openModal(item);
			});
		});

		container.querySelectorAll('.export-img').forEach(btn => {
			btn.addEventListener('click', function(){
				const tr = this.closest('tr');
				const id = Number(tr.getAttribute('data-id'));
				const items = JSON.parse(localStorage.getItem('items') || '[]');
				const item = items.find(i=>i.id===id);
				if(!item || !item.imageData) return alert('No hay imagen para exportar');
				const a = document.createElement('a');
				a.href = item.imageData;
				a.download = (item.nombre || 'producto') + '.png';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			});
		});
	}

	function escapeHtml(str){
		if(!str) return '';
		return String(str).replace(/[&<>"']/g, function(m){
			return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m];
		});
	}

	// Inicialización según página
	document.addEventListener('DOMContentLoaded', function(){
		const onLoginPage = document.querySelector('title') && document.title.toLowerCase().includes('login');
		const onIndexPage = document.querySelector('title') && document.title.toLowerCase().includes('inventario');

		if(onLoginPage) initLoginPage();
		if(onIndexPage) initIndexPage();
	});

})();

