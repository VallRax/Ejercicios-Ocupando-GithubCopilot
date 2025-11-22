/* Script de autenticación y control de sesión
   - Guarda credenciales de admin en localStorage (por defecto admin/admin123)
   - Maneja login, logout y redirecciones entre Login.html e Index.html
   - También expone funciones para actualizar credenciales desde el panel admin
*/

(function(){
	const DEFAULT_USER = 'admin';
	const DEFAULT_PASS = 'admin123';

	function getCreds(){
		const user = localStorage.getItem('adminUser') || DEFAULT_USER;
		const pass = localStorage.getItem('adminPass') || DEFAULT_PASS;
		return {user,pass};
	}

	function setCreds(user,pass){
		localStorage.setItem('adminUser', user);
		localStorage.setItem('adminPass', pass);
	}

	function isAuthenticated(){
		return !!localStorage.getItem('sessionUser');
	}

	function login(user,pass){
		const creds = getCreds();
		if(user === creds.user && pass === creds.pass){
			localStorage.setItem('sessionUser', user);
			return true;
		}
		return false;
	}

	function logout(){
		localStorage.removeItem('sessionUser');
		// go to login
		window.location = 'Login.html';
	}

	function initLoginPage(){
		const form = document.getElementById('loginForm');
		if(!form) return;
		const err = document.getElementById('loginError');

		form.addEventListener('submit', function(e){
			e.preventDefault();
			const u = document.getElementById('username').value.trim();
			const p = document.getElementById('password').value;

			if(login(u,p)){
				// redirect to main
				window.location = 'Index.html';
			} else {
				if(err){ err.style.display = 'block'; err.textContent = 'Usuario o contraseña incorrectos.' }
			}
		});

		// Si ya estamos autenticados, enviar a Index
		if(isAuthenticated()){
			window.location = 'Index.html';
		}
	}

	function initIndexPage(){
		// Si no está autenticado, ir a Login
		if(!isAuthenticated()){
			window.location = 'Login.html';
			return;
		}

		// Mostrar información de usuario y conectar logout
		const info = document.getElementById('user-info');
		const logoutBtn = document.getElementById('logoutBtn');
		const sessionUser = localStorage.getItem('sessionUser');

		if(info) info.textContent = 'Conectado como: ' + sessionUser;
		if(logoutBtn){
			logoutBtn.style.display = '';
			logoutBtn.addEventListener('click', function(){ logout() });
		}

		// Mostrar sección de inventario si existe
		const inv = document.getElementById('inventory-section');
		if(inv) inv.style.display = '';

		// Manejar actualización de credenciales desde el adminForm
		const adminForm = document.getElementById('adminForm');
		if(adminForm){
			adminForm.addEventListener('submit', function(e){
				e.preventDefault();
				const currentUser = document.getElementById('currentUser').value.trim();
				const currentPass = document.getElementById('currentPass').value;
				const newUser = document.getElementById('newUser').value.trim();
				const newPass = document.getElementById('newPass').value;

				const creds = getCreds();
				const msgEl = document.createElement('p');
				msgEl.className = 'muted small-info';

				if(currentUser === creds.user && currentPass === creds.pass){
					setCreds(newUser || creds.user, newPass || creds.pass);
					msgEl.textContent = 'Credenciales actualizadas. Cierre sesión e ingrese con las nuevas credenciales.';
					adminForm.parentNode.insertBefore(msgEl, adminForm.nextSibling);
				} else {
					msgEl.style.color = 'var(--danger)';
					msgEl.textContent = 'Credenciales actuales incorrectas.';
					adminForm.parentNode.insertBefore(msgEl, adminForm.nextSibling);
				}
			});
		}

		// Añadir comportamiento sencillo para el formulario de agregar producto si existe
		const addForm = document.getElementById('addForm');
		if(addForm){
			addForm.addEventListener('submit', function(e){
				e.preventDefault();
				// implementación sencilla: guardar producto en localStorage
				const nombre = document.getElementById('nombre').value.trim();
				const marca = document.getElementById('marca').value.trim();
				const modelo = document.getElementById('modelo').value.trim();
				const precio = parseFloat(document.getElementById('precio').value) || 0;
				const cantidad = parseInt(document.getElementById('cantidad').value) || 0;

				if(!nombre) return alert('Nombre requerido');

				const items = JSON.parse(localStorage.getItem('items') || '[]');
				items.push({id:Date.now(), nombre, marca, modelo, precio, cantidad});
				localStorage.setItem('items', JSON.stringify(items));
				renderTable();
				addForm.reset();
			});
		}

		renderTable();
	}

	function renderTable(){
		const container = document.getElementById('tableContainer');
		if(!container) return;
		const items = JSON.parse(localStorage.getItem('items') || '[]');
		if(items.length === 0){
			container.innerHTML = '<div class="empty-state">No hay productos registrados.</div>';
			return;
		}

		let html = '<table><thead><tr><th>Nombre</th><th>Marca</th><th>Modelo</th><th>Precio</th><th>Cantidad</th><th>Acciones</th></tr></thead><tbody>';
		items.forEach(it => {
			html += `<tr data-id="${it.id}">`+
				`<td>${escapeHtml(it.nombre)}</td>`+
				`<td>${escapeHtml(it.marca)}</td>`+
				`<td>${escapeHtml(it.modelo)}</td>`+
				`<td>$${Number(it.precio).toFixed(2)}</td>`+
				`<td>${it.cantidad}</td>`+
				`<td class="row-actions">`+
					`<button class="edit">Editar</button>`+
					`<button class="delete">Eliminar</button>`+
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
				renderTable();
			});
		});

		container.querySelectorAll('.edit').forEach(btn => {
			btn.addEventListener('click', function(){
				const tr = this.closest('tr');
				const id = Number(tr.getAttribute('data-id'));
				const items = JSON.parse(localStorage.getItem('items') || '[]');
				const item = items.find(i=>i.id===id);
				if(!item) return;
				const nuevaCantidad = prompt('Nueva cantidad para '+item.nombre, String(item.cantidad));
				if(nuevaCantidad===null) return;
				const n = parseInt(nuevaCantidad);
				if(Number.isNaN(n)) return alert('Cantidad inválida');
				item.cantidad = n;
				localStorage.setItem('items', JSON.stringify(items));
				renderTable();
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

