import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const teacher = '10000000-0000-4000-8000-000000000001', student = '10000000-0000-4000-8000-000000000002', other = '10000000-0000-4000-8000-000000000003', company = '10000000-0000-4000-8000-000000000004'
test('migraciones y políticas con PostgreSQL local (sin modificar Supabase)', async t => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
      create publication supabase_realtime;`)
    for (const file of ['001_schema_inicial.sql', '002_mejoras.sql', '003_etiquetas_avatares_realtime.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    for (const [id, role] of [[teacher,'docente'], [student,'alumno'], [other,'docente'], [company,'empresa']]) await db.query('insert into auth.users values($1,$2,$3)', [id, `${role}-${id}@example.org`, { role, full_name: role }])
    const old = (await db.query("insert into projects(owner_id,title,invite_code) values($1,'Proyecto existente','LK-OLD1') returning id", [teacher])).rows[0].id
    const migration = await readFile(new URL('../../supabase/migrations/004_estabilidad_y_permisos.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    const as = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated') }
    await t.test('la migración repara responsables ausentes y se puede repetir', async () => {
      assert.equal((await db.query('select status from project_members where project_id=$1 and user_id=$2', [old, teacher])).rows[0].status, 'aceptado')
      await db.exec(migration)
      assert.equal((await db.query('select count(*)::int as n from project_members where project_id=$1', [old])).rows[0].n, 1)
    })
    let pid, invitation
    await t.test('crear proyecto añade al responsable de forma atómica y permite publicar', async () => {
      await as(teacher)
      pid = (await db.query("select create_project('Proyecto privado','Descripción',false,'{}') as id")).rows[0].id
      assert.equal((await db.query('select count(*)::int as n from project_members where project_id=$1', [pid])).rows[0].n, 1)
      invitation = (await db.query('select project_invite_code($1) as code', [pid])).rows[0].code
      await db.query("insert into project_posts(project_id,author_id,content) values($1,$2,'Hola equipo')", [pid, teacher])
      await assert.rejects(db.query('select invite_code from projects'), /permission denied/)
      await assert.rejects(db.query('select email from profiles'), /permission denied/)
      assert.equal((await db.query('select center,city,education_levels from profiles where id=$1', [teacher])).rows.length, 1)
    })
    await t.test('un ajeno no ve proyectos privados ni sus invitaciones', async () => {
      await as(other)
      assert.equal((await db.query('select id from projects where id=$1', [pid])).rows.length, 0)
      await assert.rejects(db.query('select project_invite_code($1)', [pid]), /participantes/)
      await assert.rejects(db.query('select project_invite_code($1)', [old]), /participantes/)
      assert.equal((await db.query('select id from profiles where id=$1', [student])).rows.length, 0)
    })
    await t.test('alumno con código entra; una solicitud pendiente no ve actividad', async () => {
      await as(student)
      await assert.rejects(db.query("select create_project('No permitido')"), /docentes/)
      await db.query("insert into project_members(project_id,user_id,status) values($1,$2,'pendiente')", [old, student])
      await assert.rejects(db.query('select project_invite_code($1)', [old]), /participantes/)
      assert.equal((await db.query('select join_project_by_code($1) as id', [invitation.toLowerCase()])).rows[0].id, pid)
      assert.equal((await db.query('select content from project_posts where project_id=$1', [pid])).rows[0].content, 'Hola equipo')
      await as(teacher)
      assert.equal((await db.query('select full_name from profiles where id=$1', [student])).rows.length, 1)
      assert.equal((await db.query('delete from project_members where project_id=$1 and user_id=$2 returning id', [pid, teacher])).rows.length, 0)
    })
    let message
    await t.test('no se envían mensajes a alumnos ni a uno mismo; solo cambia la lectura', async () => {
      await as(teacher)
      await assert.rejects(db.query("insert into messages(sender_id,receiver_id,content) values($1,$2,'Hola')", [teacher, student]), /row-level security/)
      await assert.rejects(db.query("insert into messages(sender_id,receiver_id,content) values($1,$1,'Hola')", [teacher]), /row-level security/)
      message = (await db.query("insert into messages(sender_id,receiver_id,content) values($1,$2,'Hola') returning id", [teacher, other])).rows[0].id
      await as(other)
      await assert.rejects(db.query("update messages set content='Alterado' where id=$1", [message]), /permission denied/)
      await db.query('update messages set read_at=now() where id=$1', [message])
      assert.ok((await db.query('select read_at from messages where id=$1', [message])).rows[0].read_at)
      await assert.rejects(db.query('update profiles set role=\'alumno\' where id=$1', [other]), /tipo de cuenta/)
    })
    await t.test('la bandeja conserva contactos antiguos con más de 300 mensajes y cuenta todos los no leídos', async () => {
      await as(teacher)
      await db.query("insert into messages(sender_id,receiver_id,content,created_at) values($1,$2,'Contacto antiguo',now()-interval '2 days')", [teacher, company])
      await db.query("insert into messages(sender_id,receiver_id,content) select $1,$2,'Mensaje ' || n from generate_series(1,310) n", [teacher, other])
      const inbox = (await db.query('select * from message_conversations()')).rows
      assert.equal(inbox.length, 2)
      assert.ok(inbox.some(row => row.id === company))
      await as(other)
      assert.equal(Number((await db.query('select * from message_conversations()')).rows[0].unread), 310)
      await as(company)
      await assert.rejects(db.query('select join_project_by_code($1)', [invitation]), /rol/)
    })
    await t.test('005: búsqueda sin tildes, edición acotada y avisos en tiempo real; se puede repetir', async () => {
      await db.exec('reset role')
      const next = await readFile(new URL('../../supabase/migrations/005_busqueda_edicion_avisos.sql', import.meta.url), 'utf8')
      await db.exec(next); await db.exec(next)
      const published = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1")).rows.map(row => row.tablename)
      assert.deepEqual(published, ['messages', 'project_members', 'project_posts'])
      await as(teacher)
      await db.query("update profiles set center='Instituto Politécnico', bio='Matemáticas y robótica' where id=$1", [teacher])
      assert.equal((await db.query("select id from profiles where search like '%politecnico%' and search like '%matematicas%'")).rows.length, 1)
      const resource = (await db.query("insert into resources(owner_id,title,subject_area,resource_type,link_url) values($1,'Geometría básica','Matemáticas','external_link','https://example.org') returning id", [teacher])).rows[0].id
      assert.equal((await db.query("select id from resources where search like '%geometria%'")).rows.length, 1)
      await db.query("update resources set title='Geometría avanzada', tags='{ABP}' where id=$1", [resource])
      await assert.rejects(db.query('update resources set owner_id=$2 where id=$1', [resource, other]), /permission denied/)
      await assert.rejects(db.query("update resources set file_path='otro/fichero.pdf' where id=$1", [resource]), /permission denied/)
      await assert.rejects(db.query("update resources set link_url='javascript:alert(1)' where id=$1", [resource]), /resources_link_http/)
      await assert.rejects(db.query("update projects set title='No' where id=$1", [pid]), /projects_title_len/)
      await db.query("update projects set title='Proyecto renombrado', is_public=true where id=$1", [pid])
      assert.equal((await db.query("select id from projects where search like '%renombrado%'")).rows.length, 1)
      await as(other)
      assert.equal((await db.query("update projects set title='Ajeno modificado' where id=$1 returning id", [pid])).rows.length, 0)
      assert.equal((await db.query("update resources set title='Ajeno modificado' where id=$1 returning id", [resource])).rows.length, 0)
    })
    await t.test('006: notificaciones creadas por disparadores, agrupadas, privadas y marcables', async () => {
      await db.exec('reset role')
      const next = await readFile(new URL('../../supabase/migrations/006_notificaciones.sql', import.meta.url), 'utf8')
      await db.exec(next); await db.exec(next)
      assert.ok((await db.query("select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications'")).rows.length)
      const mine = async () => (await db.query('select type,actor_id,project_id,preview,count,read_at from notifications order by created_at, id')).rows
      await as(other)
      await db.query("insert into messages(sender_id,receiver_id,content) values($1,$2,'Primera idea')", [other, teacher])
      await db.query("insert into messages(sender_id,receiver_id,content) values($1,$2,'¿Lo hablamos  el lunes?')", [other, teacher])
      await db.query("insert into project_members(project_id,user_id,status) values($1,$2,'pendiente')", [old, other])
      assert.equal((await mine()).length, 0, 'nadie ve avisos ajenos')
      await assert.rejects(db.query("insert into notifications(user_id,type) values($1,'mensaje')", [teacher]), /permission denied/)
      await as(teacher)
      let rows = await mine()
      assert.deepEqual(rows.map(r => [r.type, r.actor_id, r.count]), [['mensaje', other, 2], ['solicitud', other, 1]])
      assert.equal(rows[0].preview, '¿Lo hablamos el lunes?')
      await assert.rejects(db.query("update notifications set type='union'"), /permission denied/)
      await db.query('update messages set read_at=now() where receiver_id=$1 and sender_id=$2', [teacher, other])
      assert.ok((await mine())[0].read_at, 'leer la conversación marca su aviso')
      await db.query("update project_members set status='aceptado' where project_id=$1 and user_id=$2", [old, other])
      await db.query("insert into project_posts(project_id,author_id,content) values($1,$2,'Reunión el jueves')", [old, teacher])
      await as(other)
      rows = await mine()
      assert.deepEqual(rows.map(r => [r.type, r.project_id]), [['aceptado', old], ['publicacion', old]])
      assert.equal(rows[1].preview, 'Reunión el jueves')
      await db.query('update notifications set read_at=now() where read_at is null')
      assert.ok((await mine()).every(r => r.read_at))
      await as(student)
      assert.equal((await mine()).filter(r => r.type === 'publicacion' && r.project_id === old).length, 0, 'una solicitud pendiente no recibe publicaciones')
    })
  } finally { await db.close() }
})
