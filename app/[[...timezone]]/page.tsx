import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CacheStateWatcher } from "../cache-state-watcher";
import { RevalidateFrom } from "../revalidate-from";

type TimeData = {
  unixtime: number;
  datetime: string;
  timezone: string;
};

const API_BASE_URL = "https://worldtimeapi.org/api/timezone";

async function fetchTimezoneList(): Promise<string[]> {
  try {
    const response = await fetch(new URL(API_BASE_URL), {
      next: { revalidate: false },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch timezone list.");
    }

    const data: string[] = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function fetchTimezoneData(zoneName: string): Promise<TimeData | null> {
  try {
    const response = await fetch(new URL(zoneName, API_BASE_URL), {
      next: { tags: ["time-data"] },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch timezone data.");
    }

    const data: TimeData = await response.json();

    return {
      timezone: data.timezone,
      datetime: data.datetime,
      unixtime: data.unixtime,
    };
  } catch (error) {
    console.error(error);

    return null;
  }
}

const PRE_RENDERED_TIMEZONES = ["CET", "WET", "Africa/Abidjan"];

export const revalidate = 500;

export async function generateStaticParams() {
  return PRE_RENDERED_TIMEZONES.map((timezone) => ({
    timezone: timezone.split("/"),
  }));
}

type PageProps = {
  params: { timezone?: string[] };
};

export default async function Page({ params: { timezone: slug = [] } }: PageProps) {
  const timezoneList = await fetchTimezoneList();

  const currentTimezone = slug.length ? slug.join("/") : PRE_RENDERED_TIMEZONES[0];

  const timeData = await fetchTimezoneData(currentTimezone);

  if (!timeData) {
    notFound();
  }

  return (
    <>
      <aside className="sidebar">
        {timezoneList.map(timezone => (
          <Link key={timezone} className="sidebar-link" href={`/${timezone}`}>
            {timezone}
          </Link>
        ))}
      </aside>
      <div className="main-content">
        <main className="widget">
          <div className="pre-rendered-at">
            {timeData.timezone} Time {timeData.datetime}
          </div>
          <Suspense fallback={null}>
            <CacheStateWatcher
              revalidateAfter={revalidate * 1000}
              time={timeData.unixtime * 1000}
            />
          </Suspense>
          <RevalidateFrom />
        </main>
      </div>
      <footer className="footer">
        <Link
          href={process.env.NEXT_PUBLIC_REDIS_INSIGHT_URL ?? "http://localhost:5540"}
          className="link"
          target="_blank"
          rel="noopener noreferrer"
        >
          View RedisInsight &#x21AA;
        </Link>
      </footer>
    </>
  );
}
