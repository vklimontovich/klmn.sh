"use client";

import { AnalyticsEvents } from "@prisma/client";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Checkbox, Button, Tag, Space, Tooltip } from "antd";
import { ReloadOutlined, RobotOutlined, CloudServerOutlined, CopyOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { Building2, Home, Bot, Globe, Server, Monitor, Smartphone, Tablet, Shield } from "lucide-react";

dayjs.extend(relativeTime);
dayjs.extend(utc);

type LocationData = {
  isBot?: boolean;
  country?: { iso_code?: string; names?: { en?: string } };
  subdivisions?: Array<{ iso_code?: string; names?: { en?: string } }>;
  city?: { names?: { en?: string } };
  postal?: { code?: string };
  location?: { latitude?: number; longitude?: number; accuracy_radius?: number };
  traits?: {
    organization?: string;
    isp?: string;
    is_hosting_provider?: boolean;
    is_anonymous?: boolean;
    is_anonymous_proxy?: boolean;
    is_residential_proxy?: boolean;
    is_public_proxy?: boolean;
    user_type?: string;
    connection_type?: string;
    autonomous_system_number?: number;
    autonomous_system_organization?: string;
  };
};

type UserAgentData = {
  browser?: { name?: string; version?: string };
  device?: { type?: string; vendor?: string; model?: string };
  os?: { name?: string; version?: string };
};

type ClientContext = {
  referrer?: string;
};

type Props = {
  events: AnalyticsEvents[];
  showBots: boolean;
  showLocalhost: boolean;
};

function isLocalhostTraffic(event: AnalyticsEvents): boolean {
  const ip = event.ip || "";
  const hostname = event.hostname || "";
  const privateIpRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^127\./, /^::1$/, /^localhost$/i];
  const isPrivateIp = privateIpRanges.some((range) => range.test(ip));
  const isLocalhostHost = hostname.includes("localhost");
  return isPrivateIp || isLocalhostHost;
}

function isBotTraffic(event: AnalyticsEvents): boolean {
  const location = event.location as LocationData | null;
  return location?.isBot === true;
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getPathFromUrl(url: string | null): string {
  if (!url) return "-";
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function getDeviceBrowser(ua: UserAgentData | null): { label: string; type: "mobile" | "tablet" | "desktop" } {
  if (!ua) return { label: "-", type: "desktop" };
  const deviceType = ua.device?.type?.toLowerCase();
  const browser = ua.browser?.name || "Unknown";
  let type: "mobile" | "tablet" | "desktop" = "desktop";
  let prefix = "Desktop";
  if (deviceType === "mobile") {
    type = "mobile";
    prefix = "Mobile";
  } else if (deviceType === "tablet") {
    type = "tablet";
    prefix = "Tablet";
  }
  return { label: `${prefix} ${browser}`, type };
}

export function AnalyticsTable({ events, showBots, showLocalhost }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!showBots && isBotTraffic(event)) return false;
      if (!showLocalhost && isLocalhostTraffic(event)) return false;
      return true;
    });
  }, [events, showBots, showLocalhost]);

  const handleFilterChange = (key: string, value: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, "true");
    } else {
      params.delete(key);
    }
    router.push(`/admin/analytics?${params.toString()}`);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const columns: ColumnsType<AnalyticsEvents> = [
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 160,
      render: (timestamp: Date) => {
        const ts = dayjs(timestamp);
        return (
          <div>
            <div>{ts.fromNow()}</div>
            <div className="text-xs text-gray-400">{ts.utc().format("YYYY-MM-DD HH:mm:ss")}</div>
          </div>
        );
      },
    },
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      width: 80,
      render: (eventType: string) => <Tag>{eventType}</Tag>,
    },
    {
      title: "Host",
      dataIndex: "hostname",
      key: "hostname",
      width: 140,
      render: (hostname: string) => hostname || "-",
    },
    {
      title: "Path",
      dataIndex: "pageUrl",
      key: "pageUrl",
      width: 200,
      render: (pageUrl: string, record: AnalyticsEvents) => {
        const path = getPathFromUrl(pageUrl);
        const clientContext = record.clientSideContext as ClientContext | null;
        const referrer = clientContext?.referrer;
        return (
          <div>
            <code className="text-xs bg-gray-100 px-1 rounded">{path}</code>
            {referrer && <div className="text-[11px] text-gray-400 truncate max-w-[200px]">{referrer}</div>}
          </div>
        );
      },
    },
    {
      title: "Location",
      key: "location",
      width: 180,
      render: (_: unknown, record: AnalyticsEvents) => {
        const location = record.location as LocationData | null;
        const countryCode = location?.country?.iso_code;
        const countryName = location?.country?.names?.en;
        const region = location?.subdivisions?.[0]?.names?.en;
        const city = location?.city?.names?.en;
        const postalCode = location?.postal?.code;
        const loc = location?.location;
        const lat = loc?.latitude;
        const lng = loc?.longitude;

        if (!countryCode) return <span className="text-gray-400">-</span>;

        const locationText = [region, city].filter(Boolean).join(", ") || countryName;

        const tooltipContent = [
          lat && lng && `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          loc?.accuracy_radius && `±${loc.accuracy_radius}km`,
        ].filter(Boolean).join(" · ");

        return (
          <div className="flex items-center gap-2">
            <span className="text-lg" title={countryName}>
              {getFlagEmoji(countryCode)}
            </span>
            <Tooltip title={tooltipContent || undefined}>
              <div className="leading-tight">
                {lat && lng ? (
                  <a
                    href={getGoogleMapsUrl(lat, lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {locationText}
                  </a>
                ) : (
                  <span>{locationText}</span>
                )}
                {postalCode && (
                  <div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${postalCode}+${countryCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-gray-400 hover:text-blue-500"
                    >
                      {postalCode}
                    </a>
                  </div>
                )}
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "Organization",
      key: "organization",
      width: 180,
      render: (_: unknown, record: AnalyticsEvents) => {
        const location = record.location as LocationData | null;
        const traits = location?.traits;

        const isBot = location?.isBot === true;
        const isLocalhost = isLocalhostTraffic(record);
        const isProxy = traits?.is_anonymous_proxy || traits?.is_residential_proxy || traits?.is_public_proxy;
        const isHosting = traits?.is_hosting_provider || traits?.user_type === "hosting";
        const userType = traits?.user_type;
        const org = traits?.organization;
        const isp = traits?.isp;
        const asn = traits?.autonomous_system_number;

        const tooltipContent = [
          asn && `AS${asn}`,
          traits?.connection_type,
        ].filter(Boolean).join(" · ");

        const OrgDisplay = ({ icon: Icon, iconClass, label, subtitle }: {
          icon: React.ElementType;
          iconClass: string;
          label: string;
          subtitle?: string;
        }) => (
          <Tooltip title={tooltipContent || undefined}>
            <div className="flex items-start gap-2">
              <Icon size={16} className={`${iconClass} mt-0.5`} />
              <div className="leading-tight">
                <div>{label}</div>
                {subtitle && <div className="text-[11px] text-gray-400">{subtitle}</div>}
              </div>
            </div>
          </Tooltip>
        );

        if (isBot) {
          return <OrgDisplay icon={Bot} iconClass="text-purple-600" label="Bot" subtitle={org || isp} />;
        }
        if (isLocalhost) {
          return <OrgDisplay icon={Server} iconClass="text-gray-400" label="Localhost" />;
        }
        if (isProxy) {
          return <OrgDisplay icon={Shield} iconClass="text-red-500" label="Proxy" subtitle={isp || org} />;
        }
        if (isHosting) {
          return <OrgDisplay icon={Globe} iconClass="text-orange-500" label="Hosting" subtitle={org || isp} />;
        }
        if (userType === "residential") {
          return <OrgDisplay icon={Home} iconClass="text-green-600" label="Residential" subtitle={isp} />;
        }
        if (userType === "business") {
          // Only show org if it's different from ISP (actual company name)
          const realOrg = org && org !== isp ? org : undefined;
          return <OrgDisplay icon={Building2} iconClass="text-blue-500" label="Business" subtitle={realOrg} />;
        }
        return <OrgDisplay icon={Globe} iconClass="text-gray-400" label={userType || "Unknown"} subtitle={isp || org} />;
      },
    },
    {
      title: "User Agent",
      key: "userAgent",
      width: 160,
      render: (_: unknown, record: AnalyticsEvents) => {
        const userAgent = record.userAgent as UserAgentData | null;
        const { label, type } = getDeviceBrowser(userAgent);
        const DeviceIcon = type === "mobile" ? Smartphone : type === "tablet" ? Tablet : Monitor;
        return (
          <div className="flex items-center gap-2">
            <DeviceIcon size={16} className="text-gray-400" />
            <span>{label}</span>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Space>
          <Checkbox checked={showBots} onChange={(e) => handleFilterChange("showBots", e.target.checked)}>
            <span className="inline-flex items-center gap-1">
              <RobotOutlined />
              Show bots
            </span>
          </Checkbox>
          <Checkbox checked={showLocalhost} onChange={(e) => handleFilterChange("showLocalhost", e.target.checked)}>
            <span className="inline-flex items-center gap-1">
              <CloudServerOutlined />
              Show localhost
            </span>
          </Checkbox>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      <p className="text-gray-500 mb-4">
        Showing {filteredEvents.length} of {events.length} events
      </p>

      <Table
        columns={columns}
        dataSource={filteredEvents}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
        scroll={{ x: 1200 }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="p-4 bg-gray-50">
              <div className="flex justify-end mb-2">
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(record, null, 2))}
                >
                  Copy JSON
                </Button>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-white p-4 rounded border overflow-auto max-h-96">
                {JSON.stringify(record, null, 2)}
              </pre>
            </div>
          ),
        }}
      />
    </div>
  );
}
