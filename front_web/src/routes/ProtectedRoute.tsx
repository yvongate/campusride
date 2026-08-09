import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import AdminLayout from '../layout/AdminLayout';

interface ProtectedRouteProps {
  children: ReactElement;
}

// Ceci n'est PAS une frontiere de securite : un token absent ne fait que
// rediriger l'UI vers /login. La securite reelle reste entierement cote
// back, verifiee a chaque appel API par RolesGuard('admin') (AD-1).
//
// Enveloppe aussi dans AdminLayout : toutes les pages protegees partagent
// la meme barre laterale, une seule ProtectedRoute pour les deux besoins
// evite de repeter <AdminLayout> dans chaque route de App.tsx.
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
