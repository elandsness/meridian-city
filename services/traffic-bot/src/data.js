'use strict'

// ---------------------------------------------------------------------------
// Fake citizen data pools — realistic enough to make traces look human
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry',
  'Iris', 'Jack', 'Karen', 'Leo', 'Maya', 'Noah', 'Olivia', 'Paul',
  'Quinn', 'Rachel', 'Sam', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xander',
  'Yasmin', 'Zoe', 'Aaron', 'Brianna', 'Carlos', 'Diana',
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris',
]

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'meridianmail.com', 'cityresident.org']

const ZONES = ['zone-north', 'zone-south', 'zone-east', 'zone-west', 'zone-central']

// Service request templates — spans all 5 categories for even Business Events coverage
const REQUEST_TEMPLATES = [
  { category: 'infrastructure', title: 'Pothole on Main St',        description: 'Large pothole near the intersection of Main St and Oak Ave causing vehicle damage.' },
  { category: 'infrastructure', title: 'Broken sidewalk',           description: 'Cracked and raised sidewalk panel creating a trip hazard on Elm Street.' },
  { category: 'infrastructure', title: 'Graffiti on bridge',        description: 'Graffiti has appeared on the underpass wall near Central Station.' },
  { category: 'infrastructure', title: 'Damaged guardrail',         description: 'Guardrail on River Road bridge is bent and needs urgent repair.' },
  { category: 'environment',    title: 'Illegal dumping',           description: 'Debris and waste illegally dumped in the vacant lot on Maple Drive.' },
  { category: 'environment',    title: 'Fallen tree blocking path', description: 'Large fallen tree is blocking the bike path in Riverside Park.' },
  { category: 'environment',    title: 'Overgrown vegetation',      description: 'Vegetation is encroaching on Heritage Lane, reducing visibility at the bend.' },
  { category: 'environment',    title: 'Dead animal on road',       description: 'Dead animal on the roadway on Pine Avenue needs to be removed.' },
  { category: 'safety',         title: 'Broken street light',       description: 'Street light on Cedar Boulevard has been out for over a week.' },
  { category: 'safety',         title: 'Vandalism at bus stop',     description: 'Bus stop shelter at 5th and Broadway has been vandalized, glass broken.' },
  { category: 'safety',         title: 'Abandoned vehicle',         description: 'Vehicle with no plates has been parked on Birch Street for two weeks.' },
  { category: 'utilities',      title: 'Water leak',                description: 'Water leaking from pipe at Park Ave and 3rd Street, pavement damage visible.' },
  { category: 'utilities',      title: 'No water pressure',         description: 'Residents on Willow Lane have experienced low water pressure for three days.' },
  { category: 'utilities',      title: 'Street drain blocked',      description: 'Drain on the corner of Ash Road is blocked causing flooding during rain.' },
  { category: 'transport',      title: 'Malfunctioning traffic light', description: 'Traffic lights at Oak St and Pine Ave are cycling incorrectly, causing congestion.' },
  { category: 'transport',      title: 'Missing road sign',         description: 'Stop sign at Birch Rd and Highway 9 has been knocked down.' },
  { category: 'transport',      title: 'Bike lane obstruction',     description: 'Construction debris is blocking the bike lane on 2nd Avenue.' },
]

const PRIORITIES = ['low', 'normal', 'normal', 'normal', 'high', 'urgent']  // weighted toward normal

// Chatbot questions — mirrors what a real citizen might type
const CHAT_QUESTIONS = [
  'Where do I report a broken streetlight?',
  'How do I submit a service request for a pothole?',
  'What are the current active incidents in the city?',
  'How long does it take to resolve a service request?',
  'Is there a water outage in the north zone?',
  'How do I check the status of my service request?',
  'What categories of service requests can I submit?',
  'Are there any road closures today?',
  'How do I contact the city utilities department?',
  'What should I do if I see a downed power line?',
  'Is the recycling center open this weekend?',
  'How do I report illegal dumping in my neighborhood?',
  'Can I track my service request online?',
  'Who do I contact about a noisy neighbor?',
  'Is the park on Oak Avenue open during winter?',
  'How do I apply for a street permit?',
  'What happens after I submit a service request?',
  'Can I attach photos to a service request?',
  'Is there a water main break on Elm Street?',
  'How do I report graffiti?',
]

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateCitizen() {
  const firstName = randomItem(FIRST_NAMES)
  const lastName  = randomItem(LAST_NAMES)
  const num       = randomInt(10, 999)
  return {
    first_name: firstName,
    last_name:  lastName,
    email:      `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@${randomItem(EMAIL_DOMAINS)}`,
    zone_id:    randomItem(ZONES),
  }
}

function generateServiceRequest(citizenId) {
  const template = randomItem(REQUEST_TEMPLATES)
  return {
    citizen_id:  citizenId,
    category:    template.category,
    title:       template.title,
    description: template.description,
    zone_id:     randomItem(ZONES),
    priority:    randomItem(PRIORITIES),
  }
}

function randomChatQuestion() {
  return randomItem(CHAT_QUESTIONS)
}

module.exports = { generateCitizen, generateServiceRequest, randomChatQuestion, ZONES }
