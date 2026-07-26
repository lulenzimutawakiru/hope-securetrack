import Link from "next/link";
import { Shield, QrCode, Factory, Package, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-hope-navy via-[#0d2847] to-hope-teal">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-10 w-10 text-hope-gold" />
          <div>
            <h1 className="text-xl font-bold text-white">Hope SecureTrack</h1>
            <p className="text-xs text-white/60">Hope Design Group Ltd</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/verify">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Verify Product
            </Button>
          </Link>
          <Link href="/login">
            <Button className="bg-hope-gold text-hope-navy hover:bg-hope-gold/90">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl">
          <h2 className="text-5xl font-bold text-white leading-tight mb-6">
            Enterprise Product Authentication &{" "}
            <span className="text-hope-gold">Manufacturing Traceability</span>
          </h2>
          <p className="text-xl text-white/70 mb-10 max-w-2xl">
            Secure QR codes, real-time production tracking, inventory management,
            and counterfeit detection for Hope Design Group paper products.
          </p>
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="bg-hope-gold text-hope-navy hover:bg-hope-gold/90">
                Access Dashboard
              </Button>
            </Link>
            <Link href="/verify">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Verify a Product
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mt-24">
          {[
            { icon: QrCode, title: "Secure QR Codes", desc: "Encrypted, signed QR codes for every product unit" },
            { icon: Factory, title: "Production Tracking", desc: "End-to-end batch and production line visibility" },
            { icon: Package, title: "Inventory Control", desc: "Warehouse, distributor, and retailer traceability" },
            { icon: BarChart3, title: "Analytics & Reports", desc: "Real-time dashboards and fraud detection" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6"
            >
              <Icon className="h-8 w-8 text-hope-gold mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/60">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="container mx-auto px-6 py-8 border-t border-white/10">
        <p className="text-center text-white/40 text-sm">
          &copy; {new Date().getFullYear()} Hope Design Group Ltd. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
