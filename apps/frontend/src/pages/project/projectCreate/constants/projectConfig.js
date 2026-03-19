// ─── Project Types ───────────────────────────────────────────────────────────
export const PROJECT_TYPES = [
  { id: "residential_apartment", label: "Apartment" },
  { id: "villa", label: "Villa" },
  { id: "commercial_office", label: "Office" },
  { id: "retail_shop", label: "Retail / Shop" },
  { id: "hospitality", label: "Hotel / Café" },
  { id: "clinic_healthcare", label: "Clinic" },
  { id: "education", label: "School / College" },
  { id: "industrial_warehouse", label: "Industrial" },
];

// ─── Room Config Options per Project Type ────────────────────────────────────
export const ROOM_CONFIG_OPTIONS = {
  residential_apartment: [
    { id: "1BHK", label: "1 BHK" },
    { id: "2BHK", label: "2 BHK" },
    { id: "3BHK", label: "3 BHK" },
    { id: "4BHK+", label: "4 BHK+" },
    { id: "Studio", label: "Studio" },
    { id: "Duplex", label: "Duplex" },
    { id: "Penthouse", label: "Penthouse" },
  ],
  villa: [
    { id: "3BHK_Villa", label: "3 BHK" },
    { id: "4BHK_Villa", label: "4 BHK" },
    { id: "5BHK_Villa", label: "5 BHK" },
    { id: "6BHK+_Villa", label: "6 BHK+" },
    { id: "Weekend_Home", label: "Weekend Home" },
    { id: "Farmhouse", label: "Farmhouse" },
  ],
  commercial_office: [
    { id: "Startup", label: "Startup / Open" },
    { id: "Corporate", label: "Corporate" },
    { id: "Coworking", label: "Co-working" },
    { id: "Cabin_Office", label: "Cabin Office" },
    { id: "Showroom_Office", label: "Showroom Office" },
    { id: "Executive_Suite", label: "Executive Suite" },
  ],
  retail_shop: [
    { id: "Clothing_Store", label: "Clothing Store" },
    { id: "Electronics", label: "Electronics" },
    { id: "Grocery", label: "Grocery / Supermarket" },
    { id: "Jewelry", label: "Jewelry Store" },
    { id: "Pharmacy", label: "Pharmacy" },
    { id: "Boutique", label: "Boutique / Luxury" },
  ],
  hospitality: [
    { id: "Restaurant", label: "Restaurant" },
    { id: "Cafe", label: "Café / Bakery" },
    { id: "Bar_Lounge", label: "Bar / Lounge" },
    { id: "Hotel_Rooms", label: "Hotel Rooms" },
    { id: "Banquet", label: "Banquet Hall" },
    { id: "Cloud_Kitchen", label: "Cloud Kitchen" },
  ],
  clinic_healthcare: [
    { id: "GP_Clinic", label: "GP / General" },
    { id: "Dental", label: "Dental Clinic" },
    { id: "Diagnostic", label: "Diagnostic Centre" },
    { id: "Specialist", label: "Specialist Clinic" },
    { id: "Wellness", label: "Wellness / Spa" },
    { id: "Hospital_Ward", label: "Hospital Ward" },
  ],
  education: [
    { id: "Preschool", label: "Pre-School" },
    { id: "School", label: "School" },
    { id: "College", label: "College / University" },
    { id: "Coaching", label: "Coaching Centre" },
    { id: "Library", label: "Library" },
    { id: "Training_Centre", label: "Training Centre" },
  ],
  industrial_warehouse: [
    { id: "Warehouse", label: "Warehouse" },
    { id: "Factory", label: "Factory / Plant" },
    { id: "Workshop", label: "Workshop" },
    { id: "Cold_Storage", label: "Cold Storage" },
    { id: "Logistics", label: "Logistics Hub" },
    { id: "Data_Centre", label: "Data Centre" },
  ],
};

// ─── Interior / Scope Types ───────────────────────────────────────────────────
export const INTERIOR_TYPES = [
  { id: "full_turnkey", label: "Full Turnkey", desc: "End-to-end: Design, procurement & execution" },
  { id: "design_only", label: "Design Only", desc: "2D/3D layouts, mood boards & drawings" },
  { id: "modular_kitchen", label: "Modular Kitchen", desc: "Cabinetry, countertops & kitchen hardware" },
  { id: "wardrobes_storage", label: "Wardrobes", desc: "Custom wardrobes, TV units & closets" },
  { id: "renovation", label: "Renovation", desc: "Improving or updating an existing space" },
  { id: "furniture_decor", label: "Furniture & Decor", desc: "Loose furniture & soft furnishings" },
  { id: "consultancy", label: "Consultancy", desc: "Professional advice per-hour or per-visit" },
];

// ─── Additional Work ──────────────────────────────────────────────────────────
export const ADDITIONAL_WORK = [
  { id: "civil_work", label: "Civil Work", icon: "🔨" },
  { id: "electrical_works", label: "Electrical", icon: "⚡" },
  { id: "plumbing_works", label: "Plumbing", icon: "🚿" },
  { id: "flooring_works", label: "Flooring", icon: "◼" },
  { id: "painting_finishing", label: "Painting & Finishing", icon: "🎨" },
  { id: "false_ceiling", label: "False Ceiling", icon: "🏗" },
  { id: "hvac_hvac", label: "HVAC", icon: "❄️" },
  { id: "metal_glass_works", label: "Metal & Glass", icon: "🪟" },
];

// ─── Locality Tiers ───────────────────────────────────────────────────────────
export const LOCALITY_TIERS = [
  { id: "Premium", label: "Premium", subText: "South Delhi · Bandra · Koramangala" },
  { id: "Mid-Market", label: "Mid-Market", subText: "Suburbs & established zones" },
  { id: "Budget", label: "Budget", subText: "Peripheral or developing areas" },
];

export const FLEXIBILITY_OPTIONS = [
  { id: "5", label: "5%" },
  { id: "10", label: "10%" },
  { id: "15", label: "15%" },
  { id: "20", label: "20%" },
];

// ─── Default Rooms by project type + config ───────────────────────────────────
export const DEFAULT_ROOMS = {
  residential_apartment: {
    "1BHK": ["Living Room", "Kitchen", "Bedroom", "Bathroom"],
    "2BHK": ["Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Master Bathroom", "Common Bathroom"],
    "3BHK": ["Foyer", "Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Master Bathroom", "Common Bathroom"],
    "4BHK+": ["Foyer", "Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Master Bathroom", "Common Bathroom"],
    "Studio": ["Living / Bedroom", "Kitchen", "Bathroom"],
    "Duplex": ["Foyer", "Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Master Bathroom", "Common Bathroom", "Terrace"],
    "Penthouse": ["Foyer", "Living Room", "Dining", "Bar Area", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Master Bathroom", "Common Bathroom", "Terrace"],
  },
  villa: {
    "3BHK_Villa": ["Foyer", "Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Master Bathroom", "Common Bathroom"],
    "4BHK_Villa": ["Foyer", "Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Study", "Master Bathroom", "Common Bathroom", "Terrace"],
    "5BHK_Villa": ["Foyer", "Living Room", "Family Lounge", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Study", "Master Bathroom", "Common Bathroom", "Terrace"],
    "6BHK+_Villa": ["Foyer", "Living Room", "Family Lounge", "Home Theatre", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6", "Study", "Master Bathroom", "Common Bathroom", "Terrace", "Pool Deck"],
    "Weekend_Home": ["Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bathroom", "Sit-out / Deck"],
    "Farmhouse": ["Living Room", "Dining", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Bathroom", "Sit-out", "Garden"],
  },
  commercial_office: {
    "Startup": ["Reception", "Open Work Area", "Meeting Room", "Lounge", "Pantry"],
    "Corporate": ["Reception", "Open Workstations", "Conference Room", "Manager Cabins", "Director Cabin", "Pantry", "Washroom"],
    "Coworking": ["Reception", "Hot Desk Zone", "Private Cabins", "Meeting Pods", "Lounge", "Pantry"],
    "Cabin_Office": ["Reception", "Director Cabin", "Manager Cabin", "Conference Room", "Waiting Area", "Pantry"],
    "Showroom_Office": ["Showroom Floor", "Reception", "Meeting Room", "Manager Cabin", "Storage", "Pantry"],
    "Executive_Suite": ["Reception", "Boardroom", "Executive Cabin", "Lounge", "Private Meeting Room", "Pantry"],
  },
  retail_shop: {
    "Clothing_Store": ["Display Area", "Trial Rooms", "Billing Counter", "Storage"],
    "Electronics": ["Display Area", "Demo Zone", "Billing Counter", "Service Area", "Storage"],
    "Grocery": ["Retail Floor", "Billing Counters", "Cold Storage", "Stockroom"],
    "Jewelry": ["Display Floor", "VIP Lounge", "Billing Counter", "Safe Room"],
    "Pharmacy": ["Retail Floor", "Dispensing Counter", "Consultation Room", "Storage"],
    "Boutique": ["Display Floor", "VIP Fitting Room", "Fitting Rooms", "Billing Counter", "Storage"],
  },
  hospitality: {
    "Restaurant": ["Dining Area", "Bar Counter", "Kitchen", "Prep Area", "Washroom"],
    "Cafe": ["Café Floor", "Counter / Bar", "Kitchen", "Storage", "Washroom"],
    "Bar_Lounge": ["Lounge Floor", "Main Bar", "VIP Section", "Kitchen", "Washroom"],
    "Hotel_Rooms": ["Lobby", "Reception", "Standard Room", "Deluxe Room", "Suite", "Restaurant"],
    "Banquet": ["Banquet Hall", "Pre-Function Area", "Kitchen", "Stage", "Washroom"],
    "Cloud_Kitchen": ["Kitchen Zone 1", "Kitchen Zone 2", "Prep Area", "Cold Storage", "Dispatch Area"],
  },
  clinic_healthcare: {
    "GP_Clinic": ["Waiting Area", "Reception", "Consultation Room", "Treatment Room", "Pharmacy", "Washroom"],
    "Dental": ["Waiting Area", "Reception", "Dental Chair 1", "Dental Chair 2", "X-Ray Room", "Sterilisation Room"],
    "Diagnostic": ["Waiting Area", "Reception", "Sample Collection", "Lab Area", "X-Ray / Scan Room", "Report Room"],
    "Specialist": ["Waiting Area", "Reception", "Consultation Room", "Procedure Room", "Washroom"],
    "Wellness": ["Reception", "Waiting Lounge", "Treatment Room 1", "Treatment Room 2", "Changing Room", "Steam / Sauna"],
    "Hospital_Ward": ["Nurse Station", "General Ward", "Private Ward", "ICU", "OT", "Utility"],
  },
  education: {
    "Preschool": ["Classroom 1", "Classroom 2", "Play Area", "Activity Room", "Washroom", "Staff Room"],
    "School": ["Classrooms", "Library", "Computer Lab", "Science Lab", "Staff Room", "Principal Office", "Washroom"],
    "College": ["Classrooms", "Lecture Hall", "Library", "Labs", "Faculty Rooms", "Admin Office", "Canteen"],
    "Coaching": ["Classroom 1", "Classroom 2", "Classroom 3", "Faculty Room", "Reception", "Washroom"],
    "Library": ["Reading Hall", "Stack Area", "Digital Zone", "Reference Section", "Issue Counter", "Washroom"],
    "Training_Centre": ["Training Hall", "Breakout Room", "Computer Lab", "Reception", "Pantry", "Washroom"],
  },
  industrial_warehouse: {
    "Warehouse": ["Storage Area", "Dispatch Zone", "Receiving Zone", "Office", "Loading Bay"],
    "Factory": ["Production Floor", "Assembly Line", "QC Area", "Storage", "Office", "Canteen"],
    "Workshop": ["Work Floor", "Tool Room", "Storage", "Office", "Washroom"],
    "Cold_Storage": ["Main Cold Room", "Freezer Zone", "Loading Bay", "Office", "Utility"],
    "Logistics": ["Sorting Area", "Dispatch Zone", "Receiving Zone", "Office", "Parking"],
    "Data_Centre": ["Server Hall", "UPS Room", "Control Room", "Network Room", "Office", "Utility"],
  },
};

// ─── Item measurement types ───────────────────────────────────────────────────
// "sqft" | "dims" (W×H×D inches) | "nos"
export const ITEM_MEASUREMENT_TYPE = {
  "False Ceiling": "sqft",
  "Flooring": "sqft",
  "Wooden Flooring": "sqft",
  "Italian Marble": "sqft",
  "Wallpaper / Texture": "sqft",
  "Paint & Finish": "sqft",
  "Veneer Panelling": "sqft",
  "Stone Cladding": "sqft",
  "Epoxy Flooring": "sqft",
  "Wardrobe": "dims",
  "Modular Kitchen": "dims",
  "TV Unit": "dims",
  "Study Table": "dims",
  "Shoe Rack": "dims",
  "Crockery Unit": "dims",
  "Loft / Upper Cabinets": "dims",
  "Console / Entry Table": "dims",
  "Vanity Unit": "dims",
  "Reception Desk": "dims",
  "Workstation Clusters": "dims",
  "Display Racks": "dims",
  "Billing Counter": "dims",
  "Storage Cabinet": "dims",
  "Sofa Set": "nos",
  "King Bed": "nos",
  "Queen Bed": "nos",
  "Single Bed": "nos",
  "Dining Table": "nos",
  "Coffee Table": "nos",
  "Curtains": "nos",
  "Pendant Lighting": "nos",
  "Ambient Lighting": "nos",
  "Mirror with Lighting": "nos",
  "Chimney": "nos",
  "Shower Enclosure": "nos",
  "Accessories Set": "nos",
  "Dressing Unit": "nos",
  "Tall Unit": "nos",
  "Under Cabinet Lighting": "nos",
  "Brand Signage": "nos",
  "Seating": "nos",
};

export const ITEM_DEFAULT_DIMS = {
  "Wardrobe": { w: 72, h: 84, d: 24 },
  "Modular Kitchen": { w: 120, h: 30, d: 24 },
  "TV Unit": { w: 72, h: 18, d: 16 },
  "Study Table": { w: 48, h: 30, d: 24 },
  "Shoe Rack": { w: 36, h: 48, d: 14 },
  "Crockery Unit": { w: 42, h: 72, d: 16 },
  "Loft / Upper Cabinets": { w: 60, h: 18, d: 20 },
  "Console / Entry Table": { w: 48, h: 30, d: 14 },
  "Vanity Unit": { w: 36, h: 30, d: 18 },
  "Reception Desk": { w: 72, h: 42, d: 24 },
  "Workstation Clusters": { w: 96, h: 30, d: 24 },
  "Display Racks": { w: 48, h: 72, d: 18 },
  "Billing Counter": { w: 60, h: 36, d: 24 },
  "Storage Cabinet": { w: 36, h: 72, d: 18 },
};

export const ITEM_DEFAULT_SQFT = {
  "False Ceiling": 200, "Flooring": 150, "Wooden Flooring": 120,
  "Italian Marble": 150, "Wallpaper / Texture": 80, "Paint & Finish": 300,
  "Veneer Panelling": 60, "Stone Cladding": 40, "Epoxy Flooring": 200,
};

export const ITEM_DEFAULT_NOS = {
  "Sofa Set": 1, "King Bed": 1, "Queen Bed": 1, "Single Bed": 2,
  "Dining Table": 1, "Coffee Table": 1, "Curtains": 2,
  "Pendant Lighting": 2, "Ambient Lighting": 4, "Mirror with Lighting": 1,
  "Chimney": 1, "Shower Enclosure": 1, "Accessories Set": 1,
  "Dressing Unit": 1, "Tall Unit": 1, "Under Cabinet Lighting": 1,
  "Brand Signage": 1, "Seating": 4,
};

// ─── Item Predictions ─────────────────────────────────────────────────────────
export const ITEM_PREDICTIONS = {
  "Living Room": [
    { name: "Sofa Set", probability: 0.95 },
    { name: "TV Unit", probability: 0.92 },
    { name: "False Ceiling", probability: 0.85 },
    { name: "Ambient Lighting", probability: 0.80 },
    { name: "Coffee Table", probability: 0.75 },
    { name: "Curtains", probability: 0.75 },
    { name: "Wallpaper / Texture", probability: 0.65 },
  ],
  "Dining": [
    { name: "Dining Table", probability: 0.95 },
    { name: "Crockery Unit", probability: 0.75 },
    { name: "Pendant Lighting", probability: 0.70 },
    { name: "False Ceiling", probability: 0.65 },
  ],
  "Kitchen": [
    { name: "Modular Kitchen", probability: 0.98 },
    { name: "Chimney", probability: 0.90 },
    { name: "Loft / Upper Cabinets", probability: 0.85 },
    { name: "Tall Unit", probability: 0.70 },
    { name: "Under Cabinet Lighting", probability: 0.68 },
    { name: "Flooring", probability: 0.70 },
  ],
  "Master Bedroom": [
    { name: "Wardrobe", probability: 0.97 },
    { name: "King Bed", probability: 0.90 },
    { name: "False Ceiling", probability: 0.78 },
    { name: "Dressing Unit", probability: 0.72 },
    { name: "Curtains", probability: 0.82 },
  ],
  "Bedroom": [
    { name: "Wardrobe", probability: 0.95 },
    { name: "Queen Bed", probability: 0.88 },
    { name: "Study Table", probability: 0.67 },
    { name: "Curtains", probability: 0.75 },
  ],
  "Bedroom 2": [
    { name: "Wardrobe", probability: 0.90 },
    { name: "Queen Bed", probability: 0.85 },
    { name: "Study Table", probability: 0.65 },
    { name: "Curtains", probability: 0.72 },
  ],
  "Bedroom 3": [
    { name: "Wardrobe", probability: 0.85 },
    { name: "Queen Bed", probability: 0.80 },
    { name: "Curtains", probability: 0.70 },
  ],
  "Bedroom 4": [
    { name: "Wardrobe", probability: 0.80 },
    { name: "Single Bed", probability: 0.78 },
    { name: "Curtains", probability: 0.65 },
  ],
  "Bathroom": [
    { name: "Vanity Unit", probability: 0.80 },
    { name: "Mirror with Lighting", probability: 0.85 },
    { name: "Accessories Set", probability: 0.90 },
  ],
  "Master Bathroom": [
    { name: "Vanity Unit", probability: 0.90 },
    { name: "Mirror with Lighting", probability: 0.92 },
    { name: "Shower Enclosure", probability: 0.70 },
    { name: "Accessories Set", probability: 0.88 },
  ],
  "Common Bathroom": [
    { name: "Vanity Unit", probability: 0.75 },
    { name: "Mirror with Lighting", probability: 0.80 },
    { name: "Accessories Set", probability: 0.85 },
  ],
  "Foyer": [
    { name: "Shoe Rack", probability: 0.88 },
    { name: "Console / Entry Table", probability: 0.72 },
    { name: "Wallpaper / Texture", probability: 0.68 },
    { name: "Ambient Lighting", probability: 0.70 },
  ],
  "Reception": [
    { name: "Reception Desk", probability: 0.97 },
    { name: "Seating", probability: 0.88 },
    { name: "False Ceiling", probability: 0.82 },
    { name: "Ambient Lighting", probability: 0.80 },
    { name: "Brand Signage", probability: 0.75 },
  ],
  "Open Work Area": [
    { name: "Workstation Clusters", probability: 0.98 },
    { name: "False Ceiling", probability: 0.78 },
    { name: "Ambient Lighting", probability: 0.80 },
  ],
  "Display Area": [
    { name: "Display Racks", probability: 0.95 },
    { name: "Ambient Lighting", probability: 0.88 },
    { name: "Flooring", probability: 0.82 },
    { name: "False Ceiling", probability: 0.78 },
  ],
  "Dining Area": [
    { name: "False Ceiling", probability: 0.85 },
    { name: "Ambient Lighting", probability: 0.88 },
    { name: "Flooring", probability: 0.80 },
    { name: "Curtains", probability: 0.70 },
  ],
  "Terrace": [
    { name: "Flooring", probability: 0.90 },
    { name: "Ambient Lighting", probability: 0.70 },
  ],
  "Default": [
    { name: "Ambient Lighting", probability: 0.70 },
    { name: "Paint & Finish", probability: 0.90 },
  ],
};

export const ITEM_CATALOG = [
  "Wardrobe", "False Ceiling", "Modular Kitchen", "Queen Bed", "King Bed", "Single Bed",
  "Study Table", "TV Unit", "Wallpaper / Texture", "Italian Marble", "Wooden Flooring",
  "Ambient Lighting", "Veneer Panelling", "Paint & Finish", "Curtains",
  "Sofa Set", "Dining Table", "Coffee Table", "Crockery Unit", "Shoe Rack",
  "Chimney", "Tall Unit", "Dressing Unit", "Console / Entry Table", "Pendant Lighting",
  "Vanity Unit", "Mirror with Lighting", "Shower Enclosure", "Reception Desk",
  "Workstation Clusters", "Display Racks", "Billing Counter", "Seating",
  "Brand Signage", "Under Cabinet Lighting", "Accessories Set", "Stone Cladding",
  "Epoxy Flooring", "Flooring", "Storage Cabinet",
];

export const ROOM_AREA_RATIOS = {
  "Living Room": 0.20, "Living / Bedroom": 0.25,
  "Dining": 0.10, "Kitchen": 0.10,
  "Master Bedroom": 0.16, "Bedroom 2": 0.12,
  "Bedroom 3": 0.10, "Bedroom 4": 0.08, "Bedroom": 0.14,
  "Master Bathroom": 0.05, "Common Bathroom": 0.04, "Bathroom": 0.05,
  "Foyer": 0.05, "Terrace": 0.08, "Storage": 0.05,
  "Reception": 0.10, "Open Work Area": 0.35,
  "Workstations": 0.30, "Meeting Room": 0.10,
  "Display Area": 0.50, "Dining Area": 0.55,
  "Default": 0.10,
};

export const ROOM_BUDGET_RATIOS = {
  "Living Room": 0.20, "Kitchen": 0.18,
  "Master Bedroom": 0.16, "Bedroom 2": 0.10,
  "Bedroom 3": 0.08, "Bedroom 4": 0.06, "Bedroom": 0.12,
  "Bathroom": 0.05, "Master Bathroom": 0.06, "Common Bathroom": 0.04,
  "Foyer": 0.04, "Dining": 0.06, "Terrace": 0.04,
  "Reception": 0.08, "Display Area": 0.20, "Dining Area": 0.25,
  "Default": 0.08,
};

export const LOCALITY_MULTIPLIERS = {
  "Premium": 1.3, "Mid-Market": 1.0, "Budget": 0.75,
};

export const BANGALORE_LOCALITIES = [
  "Whitefield", "Marathahalli", "Koramangala", "Indiranagar",
  "HSR Layout", "Sarjapur", "Electronic City", "Jayanagar", "Yelahanka",
  "Hebbal", "BTM Layout", "Rajajinagar", "Bannerghatta Road", "KR Puram",
  "Malleshwaram", "Basavanagudi", "Bellandur", "Domlur",
];

export const INDIAN_STATES = [
  "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Andhra Pradesh",
  "Maharashtra", "Delhi", "Gujarat", "Rajasthan", "West Bengal",
  "Uttar Pradesh", "Punjab", "Haryana", "Madhya Pradesh", "Bihar",
  "Odisha", "Assam", "Jharkhand", "Chhattisgarh", "Goa",
];

export const LOCATION_OPTIONS = [
  ...BANGALORE_LOCALITIES.map((name) => ({
    id: `${name}-BLR`,
    label: `${name}, Bangalore`,
    value: { type: "locality", city: "Bangalore", locality: name, state: "Karnataka" },
  })),
  ...INDIAN_STATES.map((state) => ({
    id: state, label: state,
    value: { type: "state", state },
  })),
];

export const FLEXIBILITY_LABELS = { "5": "5%", "10": "10%", "15": "15%", "20": "20%" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getRoomsForProject(projectType, subType) {
  const typeRooms = DEFAULT_ROOMS[projectType];
  if (!typeRooms) return [];
  return typeRooms[subType] || typeRooms["default"] || [];
}

export function computeRoomArea(roomName, totalArea) {
  const ratio = ROOM_AREA_RATIOS[roomName] ?? ROOM_AREA_RATIOS["Default"];
  return Math.round(totalArea * ratio);
}

export function computeRoomBudget(roomName, totalBudget, rooms) {
  const roomRatios = rooms.map((r) => ROOM_BUDGET_RATIOS[r] ?? ROOM_BUDGET_RATIOS["Default"]);
  const totalRatio = roomRatios.reduce((a, b) => a + b, 0);
  const thisRatio = ROOM_BUDGET_RATIOS[roomName] ?? ROOM_BUDGET_RATIOS["Default"];
  return Math.round((thisRatio / totalRatio) * totalBudget);
}

export function getPredictedItems(roomName, threshold = 0.65) {
  const predictions = ITEM_PREDICTIONS[roomName] ?? ITEM_PREDICTIONS["Default"];
  return predictions.filter((p) => p.probability >= threshold);
}

export function getItemMeasurementType(itemName) {
  return ITEM_MEASUREMENT_TYPE[itemName] ?? "nos";
}

export function getItemDefaultMeasurement(itemName) {
  const type = getItemMeasurementType(itemName);
  if (type === "dims") return { dims: ITEM_DEFAULT_DIMS[itemName] || { w: 48, h: 36, d: 18 } };
  if (type === "sqft") return { sqft: ITEM_DEFAULT_SQFT[itemName] || 50 };
  return { nos: ITEM_DEFAULT_NOS[itemName] || 1 };
}

export function getBudgetPositioning(totalBudget, totalArea, localityTier = "Mid-Market") {
  if (!totalBudget || !totalArea) return null;
  const perSqft = totalBudget / totalArea;
  const localityMult = LOCALITY_MULTIPLIERS[localityTier] ?? 1.0;
  const adjustedPerSqft = perSqft / localityMult;
  if (adjustedPerSqft < 800) return { label: "Under Budget", color: "#ef4444", pct: 8 };
  if (adjustedPerSqft < 1500) return { label: "Budget Tier", color: "#f59e0b", pct: 28 };
  if (adjustedPerSqft < 3000) return { label: "Market Rate", color: "#10b981", pct: 52 };
  if (adjustedPerSqft < 5000) return { label: "Premium", color: "#4F46E5", pct: 74 };
  return { label: "Luxury", color: "#7c3aed", pct: 92 };
}
