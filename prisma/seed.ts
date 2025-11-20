import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const venues = [
  // Cocktail bars
  {
    name: "Death & Co",
    lat: 40.7264,
    lng: -73.9838,
    address: "433 E 6th St, New York, NY 10009",
    neighborhood: "East Village",
    rating: 4.5,
    priceLevel: 3,
    moods: ["cocktails", "love"],
  },
  {
    name: "Employees Only",
    lat: 40.7343,
    lng: -74.0021,
    address: "510 Hudson St, New York, NY 10014",
    neighborhood: "West Village",
    rating: 4.6,
    priceLevel: 3,
    moods: ["cocktails"],
  },
  {
    name: "Attaboy",
    lat: 40.7218,
    lng: -73.9896,
    address: "134 Eldridge St, New York, NY 10002",
    neighborhood: "Lower East Side",
    rating: 4.7,
    priceLevel: 3,
    moods: ["cocktails"],
  },
  {
    name: "Dante",
    lat: 40.7323,
    lng: -74.0018,
    address: "79-81 MacDougal St, New York, NY 10012",
    neighborhood: "Greenwich Village",
    rating: 4.4,
    priceLevel: 3,
    moods: ["cocktails", "love"],
  },
  {
    name: "The Dead Rabbit",
    lat: 40.7039,
    lng: -74.0113,
    address: "30 Water St, New York, NY 10004",
    neighborhood: "Financial District",
    rating: 4.5,
    priceLevel: 3,
    moods: ["cocktails"],
  },

  // Dive bars
  {
    name: "Marie's Crisis",
    lat: 40.7338,
    lng: -74.0020,
    address: "59 Grove St, New York, NY 10014",
    neighborhood: "West Village",
    rating: 4.4,
    priceLevel: 1,
    moods: ["dive", "love"],
  },
  {
    name: "Peculier Pub",
    lat: 40.7298,
    lng: -73.9974,
    address: "145 Bleecker St, New York, NY 10012",
    neighborhood: "Greenwich Village",
    rating: 4.2,
    priceLevel: 2,
    moods: ["dive", "sports"],
  },
  {
    name: "Niagara Bar",
    lat: 40.7261,
    lng: -73.9857,
    address: "112 Avenue A, New York, NY 10009",
    neighborhood: "East Village",
    rating: 4.3,
    priceLevel: 1,
    moods: ["dive"],
  },
  {
    name: "Doc Holliday's",
    lat: 40.7256,
    lng: -73.9856,
    address: "141 Avenue A, New York, NY 10009",
    neighborhood: "East Village",
    rating: 4.1,
    priceLevel: 1,
    moods: ["dive"],
  },
  {
    name: "Skinny Dennis",
    lat: 40.7213,
    lng: -73.9587,
    address: "152 Metropolitan Ave, Brooklyn, NY 11249",
    neighborhood: "Williamsburg",
    rating: 4.3,
    priceLevel: 2,
    moods: ["dive", "dance"],
  },

  // Sports bars
  {
    name: "Boxers HK",
    lat: 40.7618,
    lng: -73.9896,
    address: "742 9th Ave, New York, NY 10019",
    neighborhood: "Hell's Kitchen",
    rating: 4.3,
    priceLevel: 2,
    moods: ["sports", "love"],
  },
  {
    name: "Legends Bar",
    lat: 40.7585,
    lng: -73.9917,
    address: "289 W 49th St, New York, NY 10019",
    neighborhood: "Midtown West",
    rating: 4.2,
    priceLevel: 2,
    moods: ["sports"],
  },
  {
    name: "Crocodile Lounge",
    lat: 40.7243,
    lng: -73.9901,
    address: "325 E 14th St, New York, NY 10003",
    neighborhood: "East Village",
    rating: 4.1,
    priceLevel: 1,
    moods: ["sports", "dive"],
  },

  // Dating/Social spots
  {
    name: "The Stonewall Inn",
    lat: 40.7339,
    lng: -74.0021,
    address: "53 Christopher St, New York, NY 10014",
    neighborhood: "West Village",
    rating: 4.5,
    priceLevel: 2,
    moods: ["love", "dive"],
  },
  {
    name: "Flaming Saddles",
    lat: 40.7616,
    lng: -73.9911,
    address: "793 9th Ave, New York, NY 10019",
    neighborhood: "Hell's Kitchen",
    rating: 4.4,
    priceLevel: 2,
    moods: ["love", "dance"],
  },
  {
    name: "The Duplex",
    lat: 40.7356,
    lng: -74.0024,
    address: "61 Christopher St, New York, NY 10014",
    neighborhood: "West Village",
    rating: 4.3,
    priceLevel: 2,
    moods: ["love"],
  },

  // Dance venues
  {
    name: "House of Yes",
    lat: 40.7090,
    lng: -73.9345,
    address: "2 Wyckoff Ave, Brooklyn, NY 11237",
    neighborhood: "Bushwick",
    rating: 4.5,
    priceLevel: 2,
    moods: ["dance", "love"],
  },
  {
    name: "Elsewhere",
    lat: 40.7088,
    lng: -73.9347,
    address: "599 Johnson Ave, Brooklyn, NY 11237",
    neighborhood: "Bushwick",
    rating: 4.6,
    priceLevel: 3,
    moods: ["dance"],
  },
  {
    name: "Brooklyn Mirage",
    lat: 40.7217,
    lng: -73.9584,
    address: "140 Stewart Ave, Brooklyn, NY 11237",
    neighborhood: "East Williamsburg",
    rating: 4.7,
    priceLevel: 4,
    moods: ["dance"],
  },
  {
    name: "Output",
    lat: 40.7213,
    lng: -73.9584,
    address: "74 Wythe Ave, Brooklyn, NY 11249",
    neighborhood: "Williamsburg",
    rating: 4.4,
    priceLevel: 3,
    moods: ["dance"],
  },
  {
    name: "Le Bain",
    lat: 40.7425,
    lng: -74.0088,
    address: "848 Washington St, New York, NY 10014",
    neighborhood: "Meatpacking District",
    rating: 4.3,
    priceLevel: 4,
    moods: ["dance", "cocktails"],
  },

  // Mixed vibe venues
  {
    name: "The Boiler Room",
    lat: 40.7252,
    lng: -73.9871,
    address: "86 E 4th St, New York, NY 10003",
    neighborhood: "East Village",
    rating: 4.2,
    priceLevel: 2,
    moods: ["dive", "love"],
  },
  {
    name: "Metropolitan Bar",
    lat: 40.7213,
    lng: -73.9583,
    address: "559 Lorimer St, Brooklyn, NY 11211",
    neighborhood: "Williamsburg",
    rating: 4.3,
    priceLevel: 2,
    moods: ["dive", "love"],
  },
  {
    name: "Julius' Bar",
    lat: 40.7351,
    lng: -74.0020,
    address: "159 W 10th St, New York, NY 10014",
    neighborhood: "West Village",
    rating: 4.5,
    priceLevel: 2,
    moods: ["dive", "sports"],
  },
  {
    name: "The Rosemont",
    lat: 40.7211,
    lng: -73.9583,
    address: "237 Bushwick Ave, Brooklyn, NY 11206",
    neighborhood: "Williamsburg",
    rating: 4.4,
    priceLevel: 2,
    moods: ["dive", "dance"],
  },
];

async function main() {
  console.log("Starting seed...");

  // Clear existing data
  await prisma.venueMood.deleteMany();
  await prisma.venue.deleteMany();

  console.log("Cleared existing venues");

  // Create venues with moods
  for (const venueData of venues) {
    const { moods, ...venueInfo } = venueData;

    const venue = await prisma.venue.create({
      data: {
        ...venueInfo,
        moods: {
          create: moods.map((mood) => ({ mood })),
        },
      },
    });

    console.log(`Created venue: ${venue.name}`);
  }

  console.log(`Seed completed! Created ${venues.length} venues.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
