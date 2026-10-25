// Print pages: no app shell, plain white page.
export default function PrintLayout({ children }: LayoutProps<"/shop/[slug]/print">) {
  return <div className="min-h-svh bg-white text-black print:min-h-0">{children}</div>;
}
