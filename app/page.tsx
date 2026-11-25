import type { Metadata } from "next";
import Header from "@/components/Header";
import HolidayBanner from "@/components/HolidayBanner";
import { CORPORATE_DJ_SOUND_USD, DJ_DAY_RATE_USD, EVENT_BRAND_NAME } from "@/lib/site";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import FromOurEvents from "@/components/FromOurEvents";
import Pricing from "@/components/Pricing";
import About from "@/components/About";
import Team from "@/components/Team";
import ContactCTA from "@/components/ContactCTA";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";

const HOME_TITLE = `${EVENT_BRAND_NAME} | Corporate Events, Holiday Parties and Weddings`;
const HOME_DESCRIPTION = `DJ, sound and MC for corporate events, holiday parties and weddings around Columbus, Indianapolis and Bloomington. $${CORPORATE_DJ_SOUND_USD.toLocaleString("en-US")} flat for corporate events, $${DJ_DAY_RATE_USD.toLocaleString("en-US")} flat for weddings.`;

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION },
};

export default function Home() {
  return (
    <>
      <HolidayBanner />
      <Header brand="events" />
      <main>
        <Hero />
        <FromOurEvents />
        <Team />
        <Services />
        <Pricing />
        <About />
        <ContactCTA />
      </main>
      <Footer />
      <StructuredData />
    </>
  );
}
