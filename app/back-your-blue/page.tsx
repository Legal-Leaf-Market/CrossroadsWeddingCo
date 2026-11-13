import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewForm from "@/components/ReviewForm";
import ShareTribute from "@/components/ShareTribute";
import { TRIBUTE_RELATIONS } from "@/lib/review-constants";
import { getTributeEntries, type PublicEntry } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

// Back YOUR Blue (2026-11-13, Jacob): his tribute to his father, Kevin Lee
// Kennedy, ahead of his 60th birthday, and the first look at a Heart of
// Columbus gratitude section. Hosted here until heartofcolumbus.com is live.
//
// Every fact below is Jacob's own, given in the session: Muncie, about 20
// years in Columbus, 21 years in the Air Force (military police, then
// personnel), the Walmart greeter joke and "From Blue to Blue" on his plaque,
// one of the five longest-tenured people at Honda in Greensburg, turning 60 on
// the 16th, the salute line, and the Yellowcard tattoo. Do not add rank, units,
// deployments, dates of service or anything Kevin thinks. No uniform, crest or
// official logo. The notes board is the moderated guestbook: nothing shows
// until Jake or Nic approves it, and notes stay on this page only.
export const dynamic = "force-dynamic";

const PATH = "/back-your-blue";
const URL = `${SITE_URL}${PATH}`;
const TITLE = "My Father, My Hero: Kevin Lee Kennedy | Back YOUR Blue";
const DESCRIPTION =
  "Jacob Kennedy honors his father, retired Air Force veteran Kevin Lee Kennedy, in the first Back YOUR Blue tribute from Heart of Columbus.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    url: PATH,
    type: "article",
    title: "My father was, and still is, my hero.",
    description: "Kevin Lee Kennedy is my dad. My Blue. A personal tribute from Jacob Kennedy, and a first look at Back YOUR Blue.",
  },
};

const ink = "text-[#1f1d1a]";
const soft = "text-[#4a443b]";

function P({ children }: { children: React.ReactNode }) {
  return <p className={`mt-6 text-[18px] leading-[1.75] sm:text-[19px] ${ink}`}>{children}</p>;
}

export default async function BackYourBluePage() {
  let entries: PublicEntry[] = [];
  let loadFailed = false;
  try {
    entries = await getTributeEntries("back-your-blue");
  } catch (err) {
    console.error("[back-your-blue] notes failed:", err);
    loadFailed = true;
  }

  return (
    <>
      <Header />
      <main className="bg-[#f6f0e4]">
        <article className="mx-auto max-w-[44rem] px-5 pb-10 pt-14 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#1f2a44]">
            Back <span className="underline decoration-[#a8834f] decoration-2 underline-offset-4">YOUR</span> Blue · A first tribute
          </p>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.08] text-[#1f1d1a] sm:text-6xl">
            My father was, and still is, my hero.
          </h1>
          <p className={`mt-5 font-display text-xl italic leading-snug sm:text-2xl ${soft}`}>
            Before Back YOUR Blue becomes a place for our community&apos;s thank you stories, I want to start with mine.
          </p>
          <p className="mt-6 border-y border-[#a8834f]/50 py-3 text-sm text-[#4a443b]">
            By <strong className="text-[#1f1d1a]">Jacob Kennedy</strong> · Co-founder &amp; Chief Editor, Heart of Columbus
          </p>

          <P>My father was, and still is, my hero.</P>
          <P>
            His name is <strong className="text-[#1f2a44]">Kevin Lee Kennedy</strong>. He&apos;s my dad. He&apos;s my Blue. And on
            November 16, he turns 60.
          </P>
          <P>
            Dad is from Muncie, Indiana, and has called Columbus home for about the last 20 years. He retired from the United
            States Air Force after 21 years of service. For the first half of his military career, he served in military police.
            In the second half, he cross-trained into personnel.
          </P>
          <P>
            He was so blue collar about the whole thing that he joked he was going to be a Walmart greeter when he got out. So
            they put &ldquo;From Blue to Blue&rdquo; on his plaque. I couldn&apos;t make this up.
          </P>
          <P>
            He didn&apos;t become a greeter. He went to work at Honda in Greensburg, and today he&apos;s one of the five
            longest-tenured people there. This guy is a tank.
          </P>
          <P>
            My father has broken generational curses. Several. On his own back. I&apos;m proud of his service, I&apos;m proud of
            the man he is, and I could not be more proud to be his son.
          </P>

          <figure className="my-12 border-l-4 border-[#1f2a44] pl-6">
            <blockquote className="font-display text-2xl leading-snug text-[#1f1d1a] sm:text-[1.9rem]">
              &ldquo;I could never quite get a salute right, but you never gave me shit for it, Dad. Love you.&rdquo;
            </blockquote>
          </figure>

          <h2 className="mt-12 font-display text-3xl text-[#1f1d1a]">The words on my arm</h2>
          <P>
            When I was 18, I got my second tattoo ever. It says <strong>&ldquo;I want to make your sacrifice worthwhile.&rdquo;</strong>{" "}
            It&apos;s a line from &ldquo;Believe&rdquo; by Yellowcard, my favorite band, a song they wrote as a thank you to the
            first responders of September 11.
          </P>
          <P>
            I&apos;m 34 now. Those words were always about him. This is my vow to make his sacrifice worth it.
          </P>

          <h2 className="mt-12 font-display text-3xl text-[#1f1d1a]">
            Why Back <span className="underline decoration-[#a8834f] decoration-2 underline-offset-4">YOUR</span> Blue
          </h2>
          <P>As we build Heart of Columbus, there is one part of it I want to share first: Back YOUR Blue.</P>
          <P>
            The word YOUR matters. I want this to be about a person. Someone whose name you know, or whose kindness you remember
            even if you never caught their name. Someone who treated you with respect. Someone who showed up when you needed help.
          </P>
          <P>
            For one person, that story might be about an officer who handled a difficult moment with dignity. For another, it
            might be an EMT, a firefighter, a dispatcher, or a veteran whose service deserves to be remembered.
          </P>
          <P>
            This will be a gratitude section. A place to say thank you, to recognize a specific act of service, and to honor the
            person behind it. No political statement is required to tell someone they mattered to you.
          </P>
          <P>For me, that person is my father. That&apos;s where I&apos;m starting. With Kevin Lee Kennedy.</P>
          <p className="mt-10 font-display text-3xl text-[#1f2a44]">Love you, Dad.</p>
          <p className={`mt-2 text-lg ${soft}`}>Jacob</p>

          <div className="mt-12">
            <ShareTribute url={URL} title="My father was, and still is, my hero." text="Kevin Lee Kennedy is my dad. My Blue. Leave him a note for his 60th." />
          </div>
        </article>

        <section className="border-t border-[#a8834f]/40 bg-[#efe6d6]" aria-labelledby="notes-h">
          <div className="mx-auto max-w-[44rem] px-5 py-14">
            <h2 id="notes-h" className="font-display text-3xl text-[#1f1d1a] sm:text-4xl">
              Notes for Kevin on his 60th
            </h2>
            <p className={`mt-3 text-[17px] leading-relaxed ${soft}`}>
              Family, friends, coworkers at Honda, church family, fellow veterans: tell Kevin what he means to you. Every note is
              read before it goes up, and they all show here, on this page only.
            </p>

            {loadFailed ? (
              <p className={`mt-6 ${soft}`}>The notes couldn&apos;t load just now. Refresh in a minute.</p>
            ) : entries.length ? (
              <ul className="mt-8 grid gap-4">
                {entries.map((e) => (
                  <li key={e.id} className="rounded-2xl border border-[#a8834f]/40 bg-[#fbf7ef] p-5">
                    <p className="whitespace-pre-line text-[17px] leading-relaxed text-[#1f1d1a]">{e.message}</p>
                    <p className="mt-3 text-sm font-semibold text-[#1f2a44]">
                      {e.name} <span className="font-normal text-[#4a443b]">· {e.relation}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-6 ${soft}`}>Be the first to leave him a note.</p>
            )}

            <div className="mt-8">
              <ReviewForm
                eventSlug="back-your-blue"
                relations={TRIBUTE_RELATIONS}
                relationLabel="You know Kevin as"
                defaultRelation="Family"
                noteLabel="Your note for Kevin"
                submitLabel="Leave a note for Kevin"
                thanks="Thank you. Jacob reads every note before it goes up, so yours will show on this page soon."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[44rem] px-5 py-14">
          <h2 className="font-display text-3xl text-[#1f1d1a]">
            Who is <span className="underline decoration-[#a8834f] decoration-2 underline-offset-4">YOUR</span> Blue?
          </h2>
          <p className={`mt-4 text-[17px] leading-relaxed ${soft}`}>
            Heart of Columbus is building a place for personal stories of gratitude for the officers, first responders, veterans,
            and other people who have shown up for this community. This tribute is our first look at that idea. More stories
            coming soon.
          </p>
          <p className="mt-8 text-sm text-[#4a443b]">
            A Heart of Columbus editorial preview, hosted by Crossroads Wedding and Event Co.{" "}
            <Link href="/" className="font-semibold text-[#1f2a44] underline underline-offset-4">
              Back to the Crossroads homepage
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
