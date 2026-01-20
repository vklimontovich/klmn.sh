"use client";

import { signIn } from "next-auth/react";
import { Button } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/admin/analytics";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error === "AccessDenied" ? "Access denied. Your email is not authorized." : "Authentication failed."}
          </div>
        )}
        <Button
          type="primary"
          icon={<GoogleOutlined />}
          size="large"
          block
          onClick={() => signIn("google", { callbackUrl })}
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
