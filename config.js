// Sync opcional con Supabase. Se commitea tal cual: la anon key es pública por diseño y la
// seguridad real la dan las políticas RLS de supabase/schema.sql. Es el proyecto compartido
// `bonapps`; para apuntar a otro, copiá config.example.js y reemplazá estos valores.
export default {
  url: 'https://iftwujsplhjbhvzibziw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmdHd1anNwbGhqYmh2emlieml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMTY0MzEsImV4cCI6MjEwMjU5MjQzMX0.8gQRIZTly1LylR4lsL53h--T25kn5kypNjXt0J1lYeI'
};
