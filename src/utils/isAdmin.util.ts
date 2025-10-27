export const isAdmin = (admin: { userId: string; role: string }) => {
  return admin.role === 'admin';
};