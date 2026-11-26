export const subtitles={
  energy:"Generators sell the electricity that powers data centres.",
  power:"Power distribution and cooling let operators add capacity to a site.",
  equipment:"Chipmakers buy wafer-processing tools when they expand or upgrade fabrication.",
  foundry:"Foundries manufacture chips for designers and earn revenue from wafer demand.",
  compute:"Chip designers sell the processors used to train and run AI models.",
  network:"Switches, optical links and interconnects move data between processors.",
  cloud:"Specialist operators rent accelerator capacity to model builders and enterprises.",
  models:"Model developers charge for access through APIs, subscriptions and distribution partners.",
  data:"Enterprises pay to store, prepare and query data for AI applications.",
  security:"Security platforms help enterprises control which users and agents can access systems.",
  payments:"Payment networks earn fees when digital commerce translates into transactions.",
  apps:"Enterprise software vendors earn revenue when customers pay for AI features or automated work.",
  devices:"Chip suppliers enable inference on phones, industrial equipment and other devices."
};

// Each entry is dated by the issuer's disclosure. Dollar amounts are company-wide USD billions.
export const guidance=[
  ["Amazon","2026-10-29","About $220bn","Cash capital expenditure","https://ir.aboutamazon.com/files/doc_earnings/2026/q3/earnings-result/AMZN-Q3-2026-Earnings-Release.pdf"],
  ["Alphabet","2026-10-28","$195–205bn","Capital expenditure","https://abc.xyz/investor/events/event-details/2026/2026-Q3-Earnings-Call-2026-Ujou16CTw9/default.aspx"],
  ["Microsoft","2026-10-28","About $170bn","Includes finance leases at commencement","https://www.microsoft.com/en-us/investor/events/fy-2027/earnings-fy-2027-q1"],
  ["Meta","2026-10-21","$135–145bn","Includes principal payments on finance leases","https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/default.aspx"]
];
export const earnings=[
  ["MongoDB","data","2026-11-05","2026-12-01","https://investors.mongodb.com/news-releases/news-release-details/mongodb-inc-announces-date-third-quarter-fiscal-2027-earnings"],
  ["Salesforce","apps","2026-11-10","2026-12-02","https://investor.salesforce.com/news/news-details/2026/Salesforce-Announces-Date-of-Third-Quarter-Fiscal-2027-Earnings-Release-and-Webcast/default.aspx"],
  ["Snowflake","data","2026-11-02","2026-12-02","https://www.snowflake.com/en/news/press-releases/fy27-q3-earnings-date-announcement/"],
  ["Broadcom","compute","2026-11-09","2026-12-09","https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announce-fourth-quarter-and-fiscal-year-2026"]
];
export function upcoming(end,items=earnings){
  // ISO dates have explicit UTC midnight. JavaScript numeric months are zero-indexed.
  const cutoff=new Date(end+"T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate()+30);
  const last=cutoff.toISOString().slice(0,10);
  return items.filter(([, ,announced,date])=>announced<=end&&date>end&&date<=last);
}
