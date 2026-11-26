export const labels = {
  UserAdmin: 'Super Admin',
  UserSetor: 'Admin de Setor',
  gestao: 'Gestão',
  ouvidoria: 'Ouvidoria',
  visualizador: 'Visualizador',
};

export function can(user, ...permissions) {
  return permissions.some(permission => user?.permissions?.includes(permission));
}

export function startPage(user) {
  if (can(user, 'dashboard.read')) return '/admin/dashboard';
  if (can(user, 'ombudsman.manage')) return '/admin/ouvidoria';
  if (can(user, 'questions.read')) return '/setor/perguntas';
  return '/403';
}
