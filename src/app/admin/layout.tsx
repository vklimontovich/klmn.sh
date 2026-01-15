import { AntdRegistry } from "@ant-design/nextjs-registry";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AntdRegistry>{children}</AntdRegistry>;
}
