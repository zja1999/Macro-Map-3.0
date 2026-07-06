import Link from "next/link";

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/audit", label: "Audit log" },
    ...(isAdmin
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/templates", label: "Templates" },
          { href: "/admin/imports", label: "Imports" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-edge bg-card p-1">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-md px-3 py-1.5 text-xs font-semibold text-ink-dim hover:bg-surface hover:text-ink">
          {link.label}
        </Link>
      ))}
    </div>
  );
}
