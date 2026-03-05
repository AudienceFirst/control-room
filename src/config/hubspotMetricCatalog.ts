/**
 * HubSpot metric catalog: Object (CRM object) → Metrics per object.
 * count_filtered: filter (property=value) + datumveld = aantal in laatste 30d dat voldoet aan beide.
 * Datum- en filtervelden worden dynamisch via de HubSpot Properties API opgehaald.
 */
export const HUBSPOT_OBJECTS = [
  { key: "contacts", label: "Contact" },
  { key: "companies", label: "Company" },
  { key: "deals", label: "Deal" },
  { key: "tickets", label: "Ticket" },
] as const;

export const HUBSPOT_METRICS: Record<
  string,
  Array<{
    key: string;
    label: string;
    description?: string;
    needsDateField: boolean;
    needsFilterProperty?: boolean;
    filterProperty?: string;
    filterLabel?: string;
    filterOptions?: Array<{ key: string; label: string }>;
  }>
> = {
  contacts: [
    { key: "count_total", label: "Totaal aantal", needsDateField: false },
    {
      key: "count_created",
      label: "Aantal aangemaakt",
      description: "Aantal records aangemaakt in de gekozen periode",
      needsDateField: true,
    },
    {
      key: "count_modified",
      label: "Aantal gewijzigd",
      description: "Aantal records gewijzigd in de gekozen periode",
      needsDateField: true,
    },
    {
      key: "count_filtered",
      label: "Aantal met filter (property + datum)",
      description:
        "Aantal dat voldoet aan een property-filter (bijv. Lead status = Nieuw) én binnen het gekozen datumveld in de laatste 30 dagen valt",
      needsDateField: true,
      needsFilterProperty: true,
    },
    {
      key: "count_filtered:lifecycle_stage:marketingqualifiedlead:hs_lifecyclestage_marketingqualifiedlead_date",
      label: "Entered Marketing Qualified Lead",
      description: "Aantal contacts dat MQL werd in de laatste 30 dagen",
      needsDateField: false,
      needsFilterProperty: false,
    },
    {
      key: "count_filtered:lifecycle_stage:salesqualifiedlead:hs_lifecyclestage_salesqualifiedlead_date",
      label: "Entered Sales Qualified Lead",
      description: "Aantal contacts dat SQL werd in de laatste 30 dagen",
      needsDateField: false,
      needsFilterProperty: false,
    },
    {
      key: "count_by_lifecycle",
      label: "Aantal per lifecycle stage",
      needsDateField: false,
      filterProperty: "lifecycle_stage",
      filterLabel: "Lifecycle stage",
      filterOptions: [
        { key: "subscriber", label: "Subscriber" },
        { key: "lead", label: "Lead" },
        { key: "marketingqualifiedlead", label: "Marketing Qualified Lead" },
        { key: "salesqualifiedlead", label: "Sales Qualified Lead" },
        { key: "opportunity", label: "Opportunity" },
        { key: "customer", label: "Customer" },
        { key: "evangelist", label: "Evangelist" },
        { key: "other", label: "Other" },
      ],
    },
  ],
  companies: [
    { key: "count_total", label: "Totaal aantal", needsDateField: false },
    {
      key: "count_created",
      label: "Aantal aangemaakt",
      needsDateField: true,
    },
    {
      key: "count_modified",
      label: "Aantal gewijzigd",
      needsDateField: true,
    },
    {
      key: "count_filtered",
      label: "Aantal met filter (property + datum)",
      description:
        "Aantal dat voldoet aan een property-filter én binnen het gekozen datumveld in de laatste 30 dagen valt",
      needsDateField: true,
      needsFilterProperty: true,
    },
  ],
  deals: [
    { key: "count_total", label: "Totaal aantal", needsDateField: false },
    {
      key: "count_created",
      label: "Aantal aangemaakt",
      needsDateField: true,
    },
    {
      key: "count_modified",
      label: "Aantal gewijzigd",
      needsDateField: true,
    },
    {
      key: "count_filtered",
      label: "Aantal met filter (property + datum)",
      description:
        "Aantal deals dat voldoet aan een property-filter én binnen het gekozen datumveld in de laatste 30 dagen valt",
      needsDateField: true,
      needsFilterProperty: true,
    },
    {
      key: "count_won",
      label: "Aantal gewonnen",
      description: "Deals in stage closedwon",
      needsDateField: false,
      filterProperty: "dealstage",
      filterLabel: "Stage",
      filterOptions: [{ key: "closedwon", label: "Gewonnen" }],
    },
    {
      key: "count_open",
      label: "Aantal open",
      description: "Deals niet gewonnen/verloren",
      needsDateField: false,
      filterProperty: "dealstage",
      filterLabel: "Stage",
      filterOptions: [{ key: "open", label: "Open (niet closedwon/closedlost)" }],
    },
  ],
  tickets: [
    { key: "count_total", label: "Totaal aantal", needsDateField: false },
    {
      key: "count_created",
      label: "Aantal aangemaakt",
      needsDateField: true,
    },
    {
      key: "count_modified",
      label: "Aantal gewijzigd",
      needsDateField: true,
    },
    {
      key: "count_filtered",
      label: "Aantal met filter (property + datum)",
      description:
        "Aantal tickets dat voldoet aan een property-filter én binnen het gekozen datumveld in de laatste 30 dagen valt",
      needsDateField: true,
      needsFilterProperty: true,
    },
  ],
};
