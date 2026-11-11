// Sample services and properties for the test suite only. The server never loads these: in production,
// staff create every service and property in the workspace.

import { Property } from "../../src/models/Property.model.js";
import { Service, ServiceCategory } from "../../src/models/Service.model.js";
import { escapeHtml } from "../../src/utils/sanitize.js";

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

const image = (file) => ({
  url: `https://res.cloudinary.com/test/image/upload/fixtures/${file}`,
  publicId: `fixtures/${file}`,
});

export const loadSampleContent = async () => {
  const now = Date.now();
  await ServiceCategory.insertMany(
    seedServiceCategories.map(({ number, title, description }, index) => ({ number, title, description, sortOrder: index }))
  );
  await Service.insertMany(
    seedServiceCategories.flatMap((category, index) =>
      category.services.map((service, position) => ({
        category: category.number,
        title: service.title,
        description: `<p>${escapeHtml(service.copy)}</p>`,
        icon: service.icon,
        sortOrder: index * 100 + position,
        status: "published",
        publishedAt: new Date(now),
      }))
    )
  );
  await Property.insertMany(
    seedProperties.map((property, index) => ({
      name: property.name,
      slug: property.slug,
      reference: property.reference,
      type: property.type,
      description: property.description,
      images: [{ ...image(property.image.file), alt: property.image.alt, position: property.image.position }],
      status: "published",
      publishedAt: new Date(now - index * 1000),
    }))
  );
};
