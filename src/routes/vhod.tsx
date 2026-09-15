import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/vhod")({
  component: () => <Navigate to="/login" replace />,
});
