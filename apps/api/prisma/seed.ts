import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding The Caddy database...');

  // Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@thecaddy.app' },
    update: {},
    create: {
      email: 'admin@thecaddy.app',
      name: 'Charlie Caddy',
      bio: 'App admin and scratch golfer',
      handicap: 0,
      homeCourse: 'Augusta National',
      role: 'SUPER_ADMIN',
    },
  });

  const scorekeeper = await prisma.user.upsert({
    where: { email: 'scorekeeper@thecaddy.app' },
    update: {},
    create: {
      email: 'scorekeeper@thecaddy.app',
      name: 'Sam Score',
      handicap: 8,
      homeCourse: 'Pebble Beach',
      role: 'SCOREKEEPER',
    },
  });

  const players = await Promise.all([
    prisma.user.upsert({
      where: { email: 'jack@example.com' },
      update: {},
      create: { email: 'jack@example.com', name: 'Jack Nicklaus Jr', handicap: 5, homeCourse: 'Muirfield Village', role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'tiger@example.com' },
      update: {},
      create: { email: 'tiger@example.com', name: 'Tiger Woods III', handicap: 2, homeCourse: 'Isleworth CC', role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'rory@example.com' },
      update: {},
      create: { email: 'rory@example.com', name: 'Rory McIlroy Jr', handicap: 3, homeCourse: 'Royal County Down', role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'phil@example.com' },
      update: {},
      create: { email: 'phil@example.com', name: 'Phil Mickelson Jr', handicap: 6, homeCourse: 'Rancho Santa Fe', role: 'USER' },
    }),
  ]);

  // Event
  const event = await prisma.event.upsert({
    where: { id: 'seed-event-1' },
    update: {},
    create: {
      id: 'seed-event-1',
      name: 'The Masters Weekend 2026',
      type: 'TOURNAMENT',
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-13'),
      location: 'Augusta, GA',
      courseId: 'augusta-national',
      createdBy: admin.id,
      isActive: true,
    },
  });

  // Participants
  const allUsers = [admin, scorekeeper, ...players];
  for (const user of allUsers) {
    await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      update: {},
      create: { eventId: event.id, userId: user.id, status: 'ACCEPTED' },
    });
  }

  // Round 1
  const round1 = await prisma.round.upsert({
    where: { id: 'seed-round-1' },
    update: {},
    create: {
      id: 'seed-round-1',
      eventId: event.id,
      courseId: 'augusta-national',
      courseName: 'Augusta National Golf Club',
      coursePhoto: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800',
      date: new Date('2026-04-11'),
    },
  });

  const holes = [
    { n: 1, par: 4 }, { n: 2, par: 5 }, { n: 3, par: 4 }, { n: 4, par: 3 }, { n: 5, par: 4 },
    { n: 6, par: 3 }, { n: 7, par: 4 }, { n: 8, par: 5 }, { n: 9, par: 4 }, { n: 10, par: 4 },
    { n: 11, par: 4 }, { n: 12, par: 3 }, { n: 13, par: 5 }, { n: 14, par: 4 }, { n: 15, par: 5 },
    { n: 16, par: 3 }, { n: 17, par: 4 }, { n: 18, par: 4 },
  ];

  for (const h of holes) {
    await prisma.roundHole.upsert({
      where: { roundId_holeNumber: { roundId: round1.id, holeNumber: h.n } },
      update: {},
      create: { roundId: round1.id, holeNumber: h.n, par: h.par },
    });
  }

  // Sample scores for each player
  const scoreSets = [
    [4, 5, 4, 3, 5, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4], // 72
    [4, 5, 3, 3, 4, 2, 4, 4, 4, 4, 4, 3, 4, 4, 5, 3, 4, 4], // 68
    [5, 5, 4, 3, 4, 3, 5, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 5], // 75
    [4, 4, 4, 3, 4, 3, 4, 5, 3, 4, 4, 2, 5, 4, 4, 3, 4, 4], // 68
    [4, 5, 4, 3, 5, 3, 4, 5, 4, 5, 4, 3, 5, 4, 5, 3, 5, 4], // 75
    [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 4], // 71
  ];

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    const scores = scoreSets[i % scoreSets.length];
    for (let h = 0; h < 18; h++) {
      await prisma.score.upsert({
        where: { roundId_userId_holeNumber: { roundId: round1.id, userId: user.id, holeNumber: h + 1 } },
        update: {},
        create: { roundId: round1.id, userId: user.id, holeNumber: h + 1, strokes: scores[h] },
      });
    }
  }

  // Itinerary
  const itineraryItems = [
    { day: 1, type: 'HOTEL' as const, title: 'Check-in: The Partridge Inn', description: 'Historic boutique hotel in Augusta', location: 'Augusta, GA', time: '15:00', mapLink: 'https://maps.google.com' },
    { day: 1, type: 'DINING' as const, title: 'Welcome Dinner: TakoSushi', description: 'Fusion restaurant, group dinner to kick off the trip', location: '2801 Washington Rd', time: '19:00', mapLink: 'https://maps.google.com' },
    { day: 2, type: 'GOLF' as const, title: 'Practice Round – Augusta National', description: 'Early tee time, carts provided', location: 'Augusta National Golf Club', time: '08:00', mapLink: 'https://maps.google.com' },
    { day: 2, type: 'NIGHTLIFE' as const, title: 'Tipsy Tiger Bar', description: 'Post-round drinks and celebrations', location: 'Augusta, GA', time: '21:00', mapLink: 'https://maps.google.com' },
    { day: 3, type: 'GOLF' as const, title: 'Tournament Round 1', description: 'Official scoring begins', location: 'Augusta National Golf Club', time: '07:30', mapLink: 'https://maps.google.com' },
    { day: 4, type: 'TRANSPORT' as const, title: 'Group Shuttle to Airport', description: 'Departing at noon', location: 'Augusta Regional Airport', time: '12:00', mapLink: 'https://maps.google.com' },
  ];

  for (const item of itineraryItems) {
    await prisma.itineraryItem.create({
      data: { eventId: event.id, ...item },
    });
  }

  // History
  const pastEvent = await prisma.event.upsert({
    where: { id: 'seed-event-2025' },
    update: {},
    create: {
      id: 'seed-event-2025',
      name: 'The Masters Weekend 2025',
      type: 'TOURNAMENT',
      startDate: new Date('2025-04-11'),
      endDate: new Date('2025-04-14'),
      location: 'Augusta, GA',
      createdBy: admin.id,
      isActive: false,
    },
  });

  await prisma.historyEntry.upsert({
    where: { id: 'seed-history-2025' },
    update: {},
    create: {
      id: 'seed-history-2025',
      eventId: pastEvent.id,
      year: 2025,
      champion: 'Tiger Woods III',
      recap: 'An incredible weekend at Augusta. Tiger dominated from round one, shooting a final score of -12 to claim the trophy by three strokes. Notable moments included an eagle on 13 and back-to-back birdies on 15-16 on Sunday.',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800',
        'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800',
      ]),
    },
  });

  // Social posts
  for (const postData of [
    { userId: players[1].id, content: 'Just drained a 40-footer for eagle on 13. This course is unreal 🏌️', courseTag: 'Augusta National', location: 'Augusta, GA', likes: 14 },
    { userId: players[0].id, content: 'Beautiful morning on the back nine. Nothing beats waking up and playing Augusta. Ready for tournament day!', courseTag: 'Augusta National', likes: 9 },
    { userId: scorekeeper.id, content: 'Scores are in for Round 1. What a battle out there. Full leaderboard update coming shortly 📊', likes: 22 },
    { userId: players[2].id, content: 'Amen Corner hit different when the azaleas are in bloom 🌸', courseTag: 'Augusta National', location: 'Augusta, GA', likes: 31 },
  ]) {
    await prisma.socialPost.create({ data: postData });
  }

  console.log('✅ Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
