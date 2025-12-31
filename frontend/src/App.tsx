import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import SignUpPage from "./pages/SignUpPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuditLogPage from "./pages/AuditLogPage";
import BlogListPage from "./pages/BlogListPage";
import BlogPostPage from "./pages/BlogPostPage";
import BlogTagPage from "./pages/BlogTagPage";
import SuccessPage from "./pages/SuccessPage";
import { getAppMode } from "./utils/appMode";

export default function App() {
  const mode = getAppMode();

  const isPublic = mode === "public";
  const isAdmin = mode === "admin";

  return (
    <Routes>
      {isAdmin ? (
        <>
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </>
      ) : isPublic ? (
        <>
          <Route path="/" element={<SignUpPage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/blog/tag/:tag" element={<BlogTagPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<SignUpPage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/blog/tag/:tag" element={<BlogTagPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}
