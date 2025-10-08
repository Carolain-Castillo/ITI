// frontend/js/admin_tools.js
document.addEventListener('DOMContentLoaded', initAdminRail);

async function initAdminRail(){
  
  let me;
  try{
    const r = await fetch('/api/me', { credentials:'same-origin' });
    const data = await r.json();
    if (!data.ok || !data.user || data.user.role !== 'admin') return; 
    me = data.user;
  }catch{ return; }

  const layout = document.querySelector('.top-layout');
  const grafico = document.querySelector('.grafico');
  if (!layout || !grafico) return;

  // Construir panel
  const rail = document.createElement('aside');
  rail.id = 'admin-rail';
  rail.className = 'admin-rail';
  rail.innerHTML = `
    <h3>Usuarios (Admin)</h3>

  <div class="admin-tabs">
    <button type="button" class="adbtn is-active" data-tab="add">Agregar</button>
    <button type="button" class="adbtn" data-tab="edit">Editar</button>
    <button type="button" class="adbtn" data-tab="del">Eliminar</button>
  </div>

  <!-- Agregar -->
  <form id="ad-form-add" class="admin-view" data-view="add" autocomplete="off">
    <!-- Campos “trampa” para desactivar autocompletado agresivo (Chrome) -->
    <input type="text" style="display:none" autocomplete="username">
    <input type="password" style="display:none" autocomplete="current-password">

    <div class="adrow">
      <label>Email</label>
      <input id="ad-add-email"
             type="email"
             inputmode="email"
             autocomplete="off"
             name="adAddEmail"
             required
             placeholder="usuario@empresa.com">
    </div>
    <div class="adrow">
      <label>Nombre</label>
      <input id="ad-add-name"
             type="text"
             autocomplete="off"
             name="adAddName"
             required
             placeholder="Nombre Apellido">
    </div>
    <div class="adrow">
      <label>Contraseña</label>
      <input id="ad-add-pass"
             type="password"
             autocomplete="new-password"
             name="adAddPass"
             required
             placeholder="••••••••">
    </div>
    <button class="adbtn--primary" type="submit">Crear usuario</button>
    <div id="ad-add-msg" class="admsg"></div>
  </form>

  <!-- Editar -->
  <form id="ad-form-edit" class="admin-view" data-view="edit" hidden autocomplete="off">
    <div class="adrow">
      <label>Selecciona usuario</label>
      <select id="ad-ed-user"></select>
    </div>
    <div class="adrow">
      <label>Nombre</label>
      <input id="ad-ed-name" type="text" autocomplete="off" name="adEdName" required>
    </div>
    <div class="adrow">
      <label>Nueva contraseña (opcional)</label>
      <input id="ad-ed-pass" type="password" autocomplete="new-password" name="adEdPass" placeholder="Dejar en blanco para no cambiar">
    </div>
    <button class="adbtn--primary" type="submit">Guardar cambios</button>
    <div id="ad-ed-msg" class="admsg"></div>
  </form>

  <!-- Eliminar -->
  <div id="ad-view-del" class="admin-view" data-view="del" hidden>
    <div class="adrow">
      <input id="ad-search" type="search" placeholder="Buscar por nombre o email…">
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="ad-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div id="ad-del-msg" class="admsg"></div>
  </div>
`;

  //  gráfico queda a su izquierda
  layout.insertBefore(rail, grafico);

  // Tabs
  const tabs = rail.querySelectorAll('.adbtn[data-tab]');
  const views = rail.querySelectorAll('.admin-view');
  tabs.forEach(b=>{
    b.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.toggle('is-active', t===b));
      const v = b.dataset.tab;
      views.forEach(vw => vw.hidden = (vw.dataset.view !== v));
    });
  });

  // Utilidad fetch JSON con manejo de errores
  const jreq = async (method, url, body) => {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok || data.ok === false) {
      throw new Error(data.msg || 'Error de servidor');
    }
    return data;
  };

  // ====== Cargar usuarios (para editar / eliminar) ======
  async function loadUsers(){
    const data = await jreq('GET', '/api/users');
    const users = data.users || [];

    // SELECT de editar
    const sel = rail.querySelector('#ad-ed-user');
    if (sel){
      sel.innerHTML = '';
      for (const u of users){
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.full_name || '(Sin nombre)'} — ${u.email}`;
        opt.dataset.name = u.full_name || '';
        sel.appendChild(opt);
      }
      // precargar nombre
      if (users.length){
        rail.querySelector('#ad-ed-name').value = users[0].full_name || '';
      }
    }

    // TABLA de eliminar
    const tbody = rail.querySelector('#ad-table tbody');
    if (tbody){
      const q = (rail.querySelector('#ad-search').value || '').toLowerCase();
      tbody.innerHTML = '';
      users
        .filter(u => Number(u.id) !== Number(me.id))
        .filter(u => !q || (u.email.toLowerCase().includes(q) || (u.full_name||'').toLowerCase().includes(q)))
        .forEach(u=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${esc(u.full_name || '')}</td>
            <td>${esc(u.email)}</td>
            <td>${esc(u.role)}</td>
            <td>${u.is_active ? 'Sí':'No'}</td>
            <td style="text-align:right">
              <button class="ad-del" title="Eliminar" data-id="${u.id}">🗑</button>
            </td>
          `;
          // Evitar que el admin se elimine a sí mismo
          if (Number(u.id) === Number(me.id)) {
            tr.querySelector('.ad-del').disabled = true;
            tr.querySelector('.ad-del').title = 'No puedes eliminar tu propio usuario';
          }
          tbody.appendChild(tr);
        });
    }
  }
  const esc = (s)=>String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

  rail.querySelector('#ad-search').addEventListener('input', loadUsers);

  // ====== Agregar ======
  rail.querySelector('#ad-form-add').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = rail.querySelector('#ad-add-email').value.trim();
    const name  = rail.querySelector('#ad-add-name').value.trim();
    const pass  = rail.querySelector('#ad-add-pass').value;
    const msg   = rail.querySelector('#ad-add-msg');

    try{
      await jreq('POST', '/api/users', {
        email, full_name: name, password: pass, role: 'operator', is_active: 1
      });
      msg.textContent = 'Usuario creado.';
      e.target.reset();
      await loadUsers();
    }catch(err){
      msg.textContent = err.message || 'No se pudo crear.';
    }
  });

  // ====== Editar ======
  rail.querySelector('#ad-ed-user').addEventListener('change', (e)=>{
    const opt = e.target.selectedOptions[0];
    rail.querySelector('#ad-ed-name').value = opt?.dataset?.name || '';
  });

  rail.querySelector('#ad-form-edit').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const id    = rail.querySelector('#ad-ed-user').value;
    const name  = rail.querySelector('#ad-ed-name').value.trim();
    const pass  = rail.querySelector('#ad-ed-pass').value;
    const msg   = rail.querySelector('#ad-ed-msg');

    const payload = { full_name: name };
    if (pass) payload.password = pass;

    try{
      await jreq('PATCH', `/api/users/${id}`, payload);
      msg.textContent = 'Cambios guardados.';
      rail.querySelector('#ad-ed-pass').value = '';
      await loadUsers();
    }catch(err){
      msg.textContent = err.message || 'No se pudo actualizar.';
    }
  });

  // ====== Eliminar ======
  rail.querySelector('#ad-table').addEventListener('click', async (e)=>{
    const btn = e.target.closest('.ad-del');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('¿Eliminar este usuario?')) return;

    try{
      await jreq('DELETE', `/api/users/${id}`);
      rail.querySelector('#ad-del-msg').textContent = 'Usuario eliminado.';
      await loadUsers();
    }catch(err){
      rail.querySelector('#ad-del-msg').textContent = err.message || 'No se pudo eliminar.';
    }
  });

  // Carga inicial
  await loadUsers();
}
