import { useEffect, useMemo, useState } from 'react'

// Fake "breaking news" ticker for the portal home page — Onion-style headlines
// that are uplifting and absurd. Replaces the old "Monitored zones" stat tile.
// Headlines are shuffled once per mount and walked in order (so no immediate
// repeats); a thin progress bar fills over each interval so the box reads as live.
const ROTATE_MS = 90000 // ~1.5 min between headlines — bump/lower this one constant to taste

const HEADLINES = [
  "Local Man Returns Library Book On Time, City Council Votes To Erect Statue",
  "Meridian Pothole Repairs Itself Out Of Sheer Civic Pride",
  "Sun Reportedly 'Showing Off' Again, Local Meteorologists Confirm",
  "City's Last Grumpy Resident Caught Smiling; Officials Cautiously Optimistic",
  "Meridian Squirrels Form Union, Demand Better Acorns; City Happily Agrees",
  "Every Single Bus Arrives Exactly On Time, Commuters Grow Suspicious",
  "Local Dog Elected Honorary Mayor, Approval Rating Hits 100%",
  "Meridian Tap Water Declared 'Too Delicious' By Visiting Sommelier",
  "Area Toddler Shares Toy Without Being Asked, Restores Nation's Faith",
  "City Park Bench Voted 'Most Comfortable Seat In The Tri-County Area'",
  "Meridian Wins 'Friendliest City' Award For 47th Consecutive Year",
  "Local Bakery's Croissants So Good They've Been Reclassified As A Public Utility",
  "Recycling Bins Report Feeling 'Deeply Appreciated' This Week",
  "Traffic Light Praised For 'Impeccable Timing,' Receives Standing Ovation",
  "Scientists Confirm Meridian Sunsets 12% More Beautiful Than Legally Required",
  "Citizen Finds $20, Turns It In; Grateful City Throws Surprise Parade",
  "Meridian Pigeons Voluntarily Clean Up After Themselves, Cite 'Civic Duty'",
  "Local Garden Gnome Promoted To Senior Garden Gnome After Years Of Service",
  "City Announces Mondays Now Optional; Productivity Somehow Increases",
  "Coffee Shop Hits Milestone: One Million Consecutive Perfect Lattes",
  "Weather Forecast Calls For 'Continued Excellence' Through Next Decade",
  "Local Cat Finally Admits It Does, In Fact, Love Its Owner",
  "Meridian Library Extends Hours To 'Whenever You Need Us, Honestly'",
  "City Fountain Switches To Sparkling Water For The Summer",
  "Area Man Compliments Stranger's Hat; Both Report Markedly Improved Day",
  "Meridian Named World's First City Where Everyone Returns Their Shopping Carts",
  "Local Geese Apologize For Earlier Honking, Promise To Keep It Down",
  "City's New Mascot, A Very Good Boy, Sworn In Wearing Tiny Hat",
  "Meridian Potholes Officially Extinct; Museum Exhibit Now Open",
  "Neighbor Returns Borrowed Ladder; Friendship Reaches New Heights",
  "Schoolchildren Solve Recess, Declare It Officially 'The Best'",
  "Farmers Market Tomato Wins Hearts, Possibly An Election",
  "City Wi-Fi Now So Fast It Loads Pages Before You Click",
  "Downtown Crosswalk Thanks Pedestrians For Looking Both Ways",
  "Town Clock Tower Apologizes For Being Two Seconds Fast Back In 1997",
  "Local Bee Pollinates Record Number Of Flowers, Takes Well-Earned Nap",
  "Meridian Ranked #1 In National 'Nicest Bus Drivers' Survey",
  "City Trees Reportedly 'Thriving,' Send Their Warmest Regards",
  "Child's Lemonade Stand Acquires Rival In Remarkably Friendly Merger",
  "Meridian's Oldest Resident Credits Longevity To 'Snacks And Minding My Business'",
  "Snow Plows Sit Idle As Weather Refuses To Be Anything But Lovely",
  "Mail Carrier Knows Everyone's Name, Their Dog's Name, And The Dog's Birthday",
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function NewsTicker() {
  const order = useMemo(() => shuffle(HEADLINES), [])
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % order.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [order.length])

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Breaking
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Meridian News</span>
      </div>
      <p
        key={i}
        className="animate-ticker-in mt-1.5 text-sm font-medium leading-snug text-slate-900 line-clamp-3"
      >
        {order[i]}
      </p>
      <span
        key={`p-${i}`}
        className="animate-ticker-progress absolute bottom-0 left-0 h-0.5 w-full bg-red-500/70"
        style={{ '--ticker-ms': `${ROTATE_MS}ms` }}
      />
    </div>
  )
}
