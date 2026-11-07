// Content currently published on the website, loaded into an empty database on first start.

export const seedProperties = [
  {
    slug: "apartment-01",
    reference: "SF-004",
    name: "Apartment 01",
    type: "Apartment",
    description:
      "A contemporary apartment building with contrasting brickwork and glass-fronted balconies, shown in the supplied exterior photograph. Contact our team for the available units, location, floor plans and confirmed specifications.",
    image: {
      file: "marlene-celine-nordvik-5q1KnUjtjaM-unsplash.jpg",
      alt: "Apartment building with contrasting brickwork and glass-fronted balconies",
      position: "50% 65%",
    },
  },
  {
    slug: "apartment-02",
    reference: "SF-005",
    name: "Apartment 02",
    type: "Apartment",
    description:
      "A multi-storey apartment building with light facades, dark vertical detailing and rows of balconies. The supplied photograph shows the building exterior; unit layouts, availability and specifications are awaiting confirmation.",
    image: {
      file: "malcolm-shadrach-_r80LCluvVM-unsplash.jpg",
      alt: "Light-coloured apartment towers with dark detailing and balconies",
      position: "50% 90%",
    },
  },
  {
    slug: "garden-residence",
    reference: "SF-001",
    name: "Garden Residence",
    type: "House",
    description:
      "A residential home featured in the Silverfox collection. Explore the exterior photograph and speak with our team for confirmed property information, viewing arrangements and availability.",
    image: { file: "ronnie-george-z11gbBo13ro-unsplash.jpg", alt: "Garden Residence exterior", position: null },
  },
  {
    slug: "classic-gabled-home",
    reference: "SF-002",
    name: "Classic Gabled Home",
    type: "House",
    description:
      "A residential home featured in the Silverfox collection. Contact our team for the location, interior photographs, layout and confirmed terms before arranging a viewing.",
    image: { file: "ian-macdonald-W8z6aiwfi1E-unsplash.jpg", alt: "Classic Gabled Home exterior", position: null },
  },
  {
    slug: "veranda-house",
    reference: "SF-003",
    name: "Veranda House",
    type: "House",
    description:
      "A residential home featured in the Silverfox collection. Our team can assist with enquiries about the property, including its location, specifications and viewing availability.",
    image: { file: "todd-kent-178j8tJrNlc-unsplash.jpg", alt: "Veranda House exterior", position: null },
  },
];

export const seedServiceCategories = [
  {
    number: "01",
    title: "Property Purchase Services",
    description:
      "Professional support for clients buying or selling property, from the initial search through completion.",
    services: [
      {
        icon: "Search",
        title: "Property search & acquisition support",
        copy: "Targeted property searches, shortlisting and buyer representation aligned with your requirements and investment priorities.",
      },
      {
        icon: "FileCheck2",
        title: "Due diligence coordination",
        copy: "Structured review and coordination of ownership, property and transaction documentation before a purchase proceeds.",
      },
      {
        icon: "Handshake",
        title: "Buyer & seller representation",
        copy: "Professional representation for property sales and purchases, with clear coordination between the parties throughout the transaction.",
      },
      {
        icon: "ScrollText",
        title: "Agreements & transfer support",
        copy: "Drafting and coordination of sale and lease agreements, together with practical assistance during the property transfer process.",
      },
    ],
  },
  {
    number: "02",
    title: "Property Management Services",
    description:
      "Consistent administration and oversight designed to protect the property and support effective tenancies.",
    services: [
      {
        icon: "KeyRound",
        title: "Tenancy agreement administration",
        copy: "Preparation and administration of tenancy agreements, renewals and the records required for a clear landlord–tenant relationship.",
      },
      {
        icon: "ShieldCheck",
        title: "Tenancy notices & transitions",
        copy: "Preparation and coordination of tenancy and eviction notices, with attention to agreed terms and the applicable process.",
      },
      {
        icon: "Building2",
        title: "Property & resident oversight",
        copy: "A dependable point of contact for occupancy matters, resident communication and the routine administration of managed properties.",
      },
      {
        icon: "Wrench",
        title: "Maintenance coordination",
        copy: "Timely coordination of maintenance needs and service providers to help preserve condition, usability and long-term property value.",
      },
    ],
  },
];

export const seedArticles = [
  {
    slug: "make-your-property-viewing-count",
    title: "Make your next property viewing count",
    category: "Finding a home",
    excerpt:
      "Look beyond the first impression. A little preparation makes it easier to compare homes and ask useful questions.",
    image: { file: "infinite-views-79NjpXDOJU8-unsplash.jpg", alt: "Bright living room with large windows and a balcony" },
    sections: [
      {
        title: "Start with your everyday needs",
        body: "Before arranging a viewing, write down what matters most: your preferred location, room requirements, commute and access to everyday services. Separate essentials from preferences. Bringing the same checklist to each viewing makes comparisons more useful than relying on photographs alone.",
      },
      {
        title: "Take time to look closely",
        body: "Walk through the rooms and consider how you would use them. Notice natural light, ventilation, storage and the condition of fixtures. Ask permission before taking photographs or testing fittings. Check which amenities belong to the unit and which are shared, and ask how shared facilities are maintained.",
      },
      {
        title: "Ask for the details",
        body: "Ask the property representative to confirm availability, the quoted price, what is included and any additional charges. Request clarification on parking, access arrangements and viewing follow-ups. Record unanswered questions so that you can resolve them before deciding whether to take the next step.",
      },
      {
        title: "Compare with a clear head",
        body: "After the visit, review your notes against your original requirements. A second visit can help answer questions about noise, light or the surrounding area. Our team can help coordinate enquiries about properties in the Silverfox collection.",
      },
    ],
  },
  {
    slug: "a-practical-property-maintenance-routine",
    title: "A practical approach to property maintenance",
    category: "Property care",
    excerpt: "Keep routine care organised with clear records, regular checks and a reliable point of contact.",
    image: { file: "aaron-huber-G7sE2S4Lab4-unsplash.jpg", alt: "Well-maintained kitchen with a central island and pendant lighting" },
    sections: [
      {
        title: "Keep a simple maintenance record",
        body: "A useful property record brings together reported issues, photographs, service dates and work completed. Keep appliance information and contractor details in one place. This gives owners and managers a clearer picture of recurring concerns and makes handovers easier.",
      },
      {
        title: "Make reporting straightforward",
        body: "Residents should know whom to contact and what information to include when reporting an issue. A short description, location and photograph can help the responsible team understand the problem. Agree how access will be arranged and how updates will be communicated.",
      },
      {
        title: "Plan routine work",
        body: "Create a schedule for routine inspections and servicing that suits the property and manufacturer guidance. Review outstanding work regularly, confirm responsibilities and keep records of approvals. Use appropriately qualified professionals for work that needs specialist skills.",
      },
      {
        title: "Close the loop",
        body: "Once work is complete, confirm what was done and whether further attention is needed. Keep the resident informed and retain the relevant records. Consistent follow-through makes property care easier to track and helps the next maintenance decision start with better information.",
      },
    ],
  },
  {
    slug: "prepare-your-property-for-management",
    title: "Preparing your property for professional management",
    category: "For property owners",
    excerpt: "A clear handover helps your management team understand the property and your priorities from the start.",
    image: { file: "ronnie-george-z11gbBo13ro-unsplash.jpg", alt: "Residential home with a landscaped front garden" },
    sections: [
      {
        title: "Explain your priorities",
        body: "Begin with a conversation about the property, its current use and the support you need. Explain how you prefer to receive updates and which decisions require your approval. A shared understanding of responsibilities is a useful foundation for the working relationship.",
      },
      {
        title: "Bring the records together",
        body: "Prepare the property information relevant to the management engagement, including existing maintenance records, inventories and service contacts. Ask your manager which documents they need and how to share them securely. Keep personal information out of public listing materials.",
      },
      {
        title: "Walk through the property",
        body: "Arrange a handover inspection to record the current condition, access arrangements and outstanding work. Identify shared facilities and any special care requirements. Photographs and written notes help everyone refer back to the same information.",
      },
      {
        title: "Agree the next steps",
        body: "Confirm the scope of services, communication arrangements and initial priorities with the team. Review how enquiries and maintenance requests will be handled. Silverfox can discuss the coordination and oversight appropriate to your property.",
      },
    ],
  },
];
