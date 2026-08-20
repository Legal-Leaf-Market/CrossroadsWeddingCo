import { SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="bg-charcoal py-8 text-center text-sm text-cream/50">
      <p>&copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.</p>
    </footer>
  );
}
