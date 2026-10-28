const db = require("../data/db");

const categories = Object.freeze(["Laptop", "Desktop", "Server"]);
const prices = [
  {
    category: "Laptop",
    name: "Screen replacement",
    description: "Cracked, flickering or dead display",
    minPriceFils: 30000,
    maxPriceFils: 110000,
    averagePriceFils: 70000,
    pricingBasis: "Per unit, incl. part"
  },
  {
    category: "Laptop",
    name: "Battery replacement",
    description: "Not holding charge or swollen battery",
    minPriceFils: 15000,
    maxPriceFils: 60000,
    averagePriceFils: 37500,
    pricingBasis: "Per unit, incl. part"
  },
  {
    category: "Laptop",
    name: "Keyboard replacement",
    description: "Stuck/broken keys or liquid-damaged keyboard",
    minPriceFils: 20000,
    maxPriceFils: 65000,
    averagePriceFils: 42500,
    pricingBasis: "Per unit, incl. part"
  },
  {
    category: "Laptop",
    name: "Hinge / body repair",
    description: "Broken hinge, cracked casing",
    minPriceFils: 15000,
    maxPriceFils: 40000,
    averagePriceFils: 27500,
    pricingBasis: "Per unit"
  },
  {
    category: "Laptop",
    name: "Charging port / DC jack repair",
    description: "Not charging, loose port",
    minPriceFils: 15000,
    maxPriceFils: 35000,
    averagePriceFils: 25000,
    pricingBasis: "Per unit"
  },
  {
    category: "Laptop",
    name: "Fan cleaning + thermal paste",
    description: "Overheating, loud fan",
    minPriceFils: 10000,
    maxPriceFils: 25000,
    averagePriceFils: 17500,
    pricingBasis: "Per service"
  },
  {
    category: "Laptop",
    name: "Liquid damage repair",
    description: "Spill damage cleaning and repair",
    minPriceFils: 30000,
    maxPriceFils: 100000,
    averagePriceFils: 65000,
    pricingBasis: "Starting range; can be higher"
  },
  {
    category: "Laptop",
    name: "Motherboard repair",
    description: "Chip-level / logic board faults",
    minPriceFils: 40000,
    maxPriceFils: 150000,
    averagePriceFils: 95000,
    pricingBasis: "Starting range; can be higher"
  },
  {
    category: "Laptop",
    name: "RAM / SSD upgrade",
    description: "Installation labour",
    minPriceFils: 5000,
    maxPriceFils: 10000,
    averagePriceFils: 7500,
    pricingBasis: "Labour only; part extra"
  },
  {
    category: "Laptop",
    name: "OS reinstall",
    description: "Windows/Linux install with drivers",
    minPriceFils: 10000,
    maxPriceFils: 20000,
    averagePriceFils: 15000,
    pricingBasis: "Per service"
  },
  {
    category: "Laptop",
    name: "Virus / malware removal",
    description: "Cleanup and security check",
    minPriceFils: 10000,
    maxPriceFils: 20000,
    averagePriceFils: 15000,
    pricingBasis: "Per service"
  },
  {
    category: "Laptop",
    name: "Data recovery",
    description: "Recover files from failed drive",
    minPriceFils: 30000,
    maxPriceFils: 200000,
    averagePriceFils: 115000,
    pricingBasis: "Depends on damage"
  },
  {
    category: "Desktop",
    name: "Diagnosis",
    description: "Fault finding",
    minPriceFils: 0,
    maxPriceFils: 10000,
    averagePriceFils: 5000,
    pricingBasis: "Often free if repaired"
  },
  {
    category: "Desktop",
    name: "Power supply replacement",
    description: "Dead or failing PSU",
    minPriceFils: 15000,
    maxPriceFils: 40000,
    averagePriceFils: 27500,
    pricingBasis: "Incl. part"
  },
  {
    category: "Desktop",
    name: "Hard drive / SSD replacement",
    description: "Failed or slow drive",
    minPriceFils: 15000,
    maxPriceFils: 50000,
    averagePriceFils: 32500,
    pricingBasis: "Incl. part"
  },
  {
    category: "Desktop",
    name: "RAM upgrade",
    description: "Add or replace memory",
    minPriceFils: 10000,
    maxPriceFils: 40000,
    averagePriceFils: 25000,
    pricingBasis: "Incl. part"
  },
  {
    category: "Desktop",
    name: "Graphics card installation",
    description: "Install GPU and drivers",
    minPriceFils: 5000,
    maxPriceFils: 10000,
    averagePriceFils: 7500,
    pricingBasis: "Labour only; part extra"
  },
  {
    category: "Desktop",
    name: "Motherboard replacement",
    description: "Failed motherboard",
    minPriceFils: 30000,
    maxPriceFils: 100000,
    averagePriceFils: 65000,
    pricingBasis: "Incl. part"
  },
  {
    category: "Desktop",
    name: "OS reinstall",
    description: "Windows/Linux install with drivers",
    minPriceFils: 10000,
    maxPriceFils: 20000,
    averagePriceFils: 15000,
    pricingBasis: "Per service"
  },
  {
    category: "Desktop",
    name: "Virus / malware removal",
    description: "Cleanup and security check",
    minPriceFils: 10000,
    maxPriceFils: 20000,
    averagePriceFils: 15000,
    pricingBasis: "Per service"
  },
  {
    category: "Desktop",
    name: "Cleaning and maintenance",
    description: "Dust cleaning, thermal paste, checks",
    minPriceFils: 8000,
    maxPriceFils: 15000,
    averagePriceFils: 11500,
    pricingBasis: "Per service"
  },
  {
    category: "Desktop",
    name: "Custom PC build",
    description: "Assembly and setup",
    minPriceFils: 15000,
    maxPriceFils: 40000,
    averagePriceFils: 27500,
    pricingBasis: "Labour only; parts extra"
  },
  {
    category: "Desktop",
    name: "Network / printer setup",
    description: "Connect network and printers",
    minPriceFils: 10000,
    maxPriceFils: 25000,
    averagePriceFils: 17500,
    pricingBasis: "Per visit"
  },
  {
    category: "Desktop",
    name: "Data backup and recovery",
    description: "Backup setup or file recovery",
    minPriceFils: 20000,
    maxPriceFils: 150000,
    averagePriceFils: 85000,
    pricingBasis: "Depends on scope"
  },
  {
    category: "Server",
    name: "Installation and rack mounting",
    description: "Physical install and cabling",
    minPriceFils: 50000,
    maxPriceFils: 150000,
    averagePriceFils: 100000,
    pricingBasis: "Per server"
  },
  {
    category: "Server",
    name: "Server OS setup",
    description: "Windows Server / Linux install",
    minPriceFils: 100000,
    maxPriceFils: 300000,
    averagePriceFils: 200000,
    pricingBasis: "Per server"
  },
  {
    category: "Server",
    name: "RAID configuration",
    description: "Storage array setup",
    minPriceFils: 50000,
    maxPriceFils: 150000,
    averagePriceFils: 100000,
    pricingBasis: "Per server"
  },
  {
    category: "Server",
    name: "Hardware part replacement",
    description: "Disk, PSU, fan or RAM swap",
    minPriceFils: 30000,
    maxPriceFils: 100000,
    averagePriceFils: 65000,
    pricingBasis: "Labour; part extra"
  },
  {
    category: "Server",
    name: "Virtualization setup",
    description: "VMware, Hyper-V, Proxmox",
    minPriceFils: 200000,
    maxPriceFils: 800000,
    averagePriceFils: 500000,
    pricingBasis: "Per project"
  },
  {
    category: "Server",
    name: "Active Directory / DNS / DHCP setup",
    description: "Domain and network services",
    minPriceFils: 150000,
    maxPriceFils: 500000,
    averagePriceFils: 325000,
    pricingBasis: "Per project"
  },
  {
    category: "Server",
    name: "File / email server setup",
    description: "Shared storage or mail server",
    minPriceFils: 150000,
    maxPriceFils: 500000,
    averagePriceFils: 325000,
    pricingBasis: "Per project"
  },
  {
    category: "Server",
    name: "Backup and disaster recovery setup",
    description: "Backup solution and restore plan",
    minPriceFils: 200000,
    maxPriceFils: 1000000,
    averagePriceFils: 600000,
    pricingBasis: "Per project"
  },
  {
    category: "Server",
    name: "Security hardening and firewall",
    description: "Patching, firewall, antivirus",
    minPriceFils: 100000,
    maxPriceFils: 400000,
    averagePriceFils: 250000,
    pricingBasis: "Per server"
  },
  {
    category: "Server",
    name: "Performance monitoring setup",
    description: "Alerts and health dashboards",
    minPriceFils: 100000,
    maxPriceFils: 300000,
    averagePriceFils: 200000,
    pricingBasis: "Per project"
  },
  {
    category: "Server",
    name: "Emergency on-site call-out",
    description: "Urgent fault response",
    minPriceFils: 30000,
    maxPriceFils: 80000,
    averagePriceFils: 55000,
    pricingBasis: "Per visit"
  },
  {
    category: "Server",
    name: "Server AMC",
    description: "Annual maintenance contract",
    minPriceFils: 300000,
    maxPriceFils: 1200000,
    averagePriceFils: 750000,
    pricingBasis: "Per server, per year"
  },
  {
    category: "Server",
    name: "Office IT AMC",
    description: "Annual maintenance for office PCs",
    minPriceFils: 30000,
    maxPriceFils: 80000,
    averagePriceFils: 55000,
    pricingBasis: "Per PC, per year"
  }
];

const countPrices = db.prepare("SELECT COUNT(*) AS count FROM repair_prices");
const insertPrice = db.prepare(`
  INSERT INTO repair_prices (
    category,
    name,
    description,
    minPriceFils,
    maxPriceFils,
    averagePriceFils,
    pricingBasis
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const allPrices = db.prepare(`
  SELECT * FROM repair_prices
  ORDER BY CASE category
    WHEN 'Laptop' THEN 1
    WHEN 'Desktop' THEN 2
    WHEN 'Server' THEN 3
  END, name
`);
const pricesByCategory = db.prepare(`
  SELECT * FROM repair_prices
  WHERE category = ?
  ORDER BY name
`);

function seedRepairPricesIfEmpty() {
  if (countPrices.get().count > 0) {
    return;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const price of prices) {
      insertPrice.run(
        price.category,
        price.name,
        price.description,
        price.minPriceFils,
        price.maxPriceFils,
        price.averagePriceFils,
        price.pricingBasis
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedRepairPricesIfEmpty();

function listRepairPrices(category) {
  if (category && !categories.includes(category)) {
    throw new RangeError(`Unknown repair price category: ${category}`);
  }
  return category ? pricesByCategory.all(category) : allPrices.all();
}

module.exports = {
  categories,
  listRepairPrices
};
