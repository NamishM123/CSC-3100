# Price Pantry Software Requirements Document

## 1. Product Vision

For budget-conscious grocery shoppers who need an easier way to find affordable groceries nearby, **Price Pantry** is a **grocery price-comparison and shopping-planning application** that helps users find the lowest-cost way to purchase everything on their grocery list. Unlike **Instacart**, Price Pantry compares item prices and availability across nearby stores to identify a single store that carries the complete list, while also showing whether alternatives such as splitting the trip or choosing equivalent products would provide worthwhile savings.

### Product Vision Components

| Template element | Price Pantry definition |
|---|---|
| Target customer | Budget-conscious grocery shoppers |
| Need or opportunity | An easier way to find affordable groceries nearby without manually checking several stores |
| Product name | Price Pantry |
| Product category | Grocery price-comparison and shopping-planning application |
| Key benefit/reason to buy | Finds the lowest-cost practical way to purchase an entire grocery list |
| Primary competitive alternative | Instacart |
| Primary differentiation | Compares complete-list prices and item availability across nearby stores to find one store with every item, while also presenting other money-saving options |

## 2. Scope

Price Pantry will allow shoppers to build grocery lists, review nearby stores and their available products, compare shopping options, and make purchasing decisions based on price, availability, distance, personal preferences, and estimated travel effort. The initial product supports shopping planning and comparison; purchasing, delivery, and guaranteed real-time inventory are outside the current scope.

## 3. User Stories

Every story follows the format **“As a [type of user], I want [behavior/action] so that [benefit/value].”** Each story represents one distinct, valuable capability and includes acceptance criteria so that it is small, estimable, and testable.

### 3.1 Noah

**Main author: Noah**

#### US-NO-1 — Nearby stores

As a customer, I want to be able to see grocery stores near me so that I know what my options are to buy groceries.

**Acceptance criteria:**

- The user can provide a location through device permission or manual entry.
- The system displays nearby grocery stores with each store's name, address, and distance.
- The user can change the search radius and refresh the results.

#### US-NO-2 — Store grocery inventory

As a customer, I want to be able to look at a store's log of groceries so that I know if a store has what I need.

**Acceptance criteria:**

- Selecting a store displays its available grocery items and known prices.
- The user can search or filter the store's grocery catalog.
- Each item displays an availability status and the time at which the information was last updated.

#### US-NO-3 — Cheapest complete-list store

As a customer, I want to find a store with all items for the lowest price so that I only have to go to one store.

**Acceptance criteria:**

- The system compares the user's complete list across nearby stores.
- The system identifies the lowest-priced single store known to carry every requested item.
- The result displays an itemized total, and the system clearly reports when no compared store carries the complete list.

### 3.2 Andrew

**Main author: Andrew**

#### US-AN-1 — Search history

As a customer, I want to view my search history so that I can quickly find and repurchase items I previously searched for.

**Acceptance criteria:**

- Previous searches are displayed from newest to oldest.
- The user can rerun a previous search without re-entering its information.
- The user can delete an individual search or clear the entire history.

#### US-AN-2 — Saved grocery lists

As a customer, I want to save frequently purchased grocery lists so that I do not have to re-enter the same items every time I shop.

**Acceptance criteria:**

- The user can create, name, edit, and delete a saved grocery list.
- A saved list retains its items and requested quantities.
- The user can load a saved list into a new store and price comparison.

#### US-AN-3 — Sale notifications

As a customer, I want to receive notifications when items on my saved grocery lists go on sale nearby so that I can shop when prices are lowest.

**Acceptance criteria:**

- The user can opt in to or disable sale notifications.
- A notification identifies the item, sale price, store, and sale period when that information is available.
- Notifications only use stores within the user's selected search area.

### 3.3 Adarsh

**Main author: Adarsh**

#### US-AD-1 — Lower-cost alternatives

As a frequent grocery shopper, I want to receive cheaper store-brand or equivalent-item suggestions so that I can lower my grocery bill without missing the items I need.

**Acceptance criteria:**

- The system can suggest a lower-priced comparable item when one is available.
- Each suggestion displays the original item, suggested item, relevant size information, and expected savings.
- The user can accept the suggestion or retain the original item.

#### US-AD-2 — Loyalty pricing

As a loyalty-program member, I want discounts, coupons, and membership prices included in my estimated total so that I can see what I will actually pay.

**Acceptance criteria:**

- The user can indicate the store loyalty programs to which they belong.
- Eligible discounts and membership prices are included in the estimated total.
- The system distinguishes regular prices from loyalty prices and lists the applied savings.

#### US-AD-3 — Savings versus travel time

As a busy student, I want to compare the savings from splitting my list across multiple stores with the additional travel time so that I can decide whether the savings are worthwhile.

**Acceptance criteria:**

- The system compares a one-store plan with at least one split-store plan when both are possible.
- Each plan displays its grocery total, number of stops, estimated travel distance, and estimated travel time.
- The user can choose a plan without the system automatically changing the grocery list.

### 3.4 Namish

**Main author: Namish**

#### US-NA-1 — Dietary and allergy filters

As a shopper with dietary restrictions, I want to filter products by dietary needs and allergies so that I only see items that are safe for me.

**Acceptance criteria:**

- The user can select one or more supported dietary or allergen filters.
- Products known to conflict with a selected filter are excluded or clearly warned against.
- Products with incomplete dietary information are labeled as unverified rather than assumed safe.

#### US-NA-2 — Unit-price comparison

As a shopper, I want to compare products by price per unit so that I can identify the best value across different package sizes.

**Acceptance criteria:**

- The system displays a normalized unit price when package size and price data are available.
- Comparable products use the same measurement unit in a comparison.
- If a unit price cannot be calculated, the system labels it as unavailable instead of presenting an estimate.

#### US-NA-3 — Shared household lists

As a household member, I want to share a grocery list that others can update in real time so that everyone can add what they need and avoid duplicate purchases.

**Acceptance criteria:**

- A list owner can invite another user to a shared grocery list.
- Authorized members can add, edit, check off, and remove items.
- Changes made by one member become visible to the other members without requiring the list to be recreated.

## 4. INVEST Validation

The user stories satisfy the INVEST guidelines as follows:

- **Independent:** Each story describes a distinct user capability that can be prioritized and evaluated separately.
- **Negotiable:** The stories define the desired outcome without requiring a specific interface or implementation.
- **Valuable:** Every story contains a clear user benefit in its “so that” clause.
- **Estimable:** Each story has a bounded behavior and defined result that the development team can estimate.
- **Small:** Each story focuses on one primary user goal and is suitable for implementation within a sprint. If implementation estimates reveal that a story is too large, it can be divided by workflow or supported data source without changing its user value.
- **Testable:** Every story includes observable acceptance criteria that can be verified during testing.

## 5. Functional Requirements

| ID | Functional requirement | Related story |
|---|---|---|
| FR-01 | The system shall accept a device location or manually entered location and return grocery stores within a user-selected radius. | US-NO-1 |
| FR-02 | The system shall display each returned store's name, address, and distance from the user's location. | US-NO-1 |
| FR-03 | The system shall display a selected store's searchable grocery catalog, including known price, availability status, and last-updated time for each item. | US-NO-2 |
| FR-04 | The system shall compare a complete grocery list across nearby stores and identify the lowest-total-cost single store known to carry every item. | US-NO-3 |
| FR-05 | The system shall display an itemized estimated total and identify any missing or unavailable items. | US-NO-3 |
| FR-06 | The system shall store a user's recent searches and allow the user to rerun or delete them. | US-AN-1 |
| FR-07 | The system shall allow a user to create, name, edit, load, and delete reusable grocery lists. | US-AN-2 |
| FR-08 | The system shall allow a user to opt in to sale alerts for items on saved lists and to configure the applicable geographic area. | US-AN-3 |
| FR-09 | The system shall include the item, store, sale price, and known sale period in each sale notification. | US-AN-3 |
| FR-10 | The system shall recommend lower-priced comparable products and show the expected savings and relevant package-size information. | US-AD-1 |
| FR-11 | The system shall allow the user to accept or reject each suggested substitute. | US-AD-1 |
| FR-12 | The system shall allow the user to identify applicable store loyalty programs and shall include eligible discounts in estimated totals. | US-AD-2 |
| FR-13 | The system shall distinguish regular prices, loyalty prices, and applied savings. | US-AD-2 |
| FR-14 | The system shall compare single-store and split-store shopping plans using grocery cost, number of stops, travel distance, and estimated travel time. | US-AD-3 |
| FR-15 | The system shall allow users to apply supported dietary and allergen filters and shall flag products whose compatibility cannot be verified. | US-NA-1 |
| FR-16 | The system shall calculate and display normalized unit prices when the required product price and package-size data are available. | US-NA-2 |
| FR-17 | The system shall allow a list owner to share a grocery list with authorized household members. | US-NA-3 |
| FR-18 | The system shall synchronize item additions, edits, removals, and completion status among authorized members of a shared list. | US-NA-3 |

## 6. Non-Functional Requirements

| ID | Category | Non-functional requirement |
|---|---|---|
| NFR-01 | Performance | Under normal operating conditions, nearby-store and catalog views shall load within 2 seconds for at least 95% of requests. |
| NFR-02 | Performance | A price comparison for a list of up to 50 items across up to 20 stores shall return within 5 seconds for at least 95% of requests. |
| NFR-03 | Availability | The production service shall maintain at least 99.5% monthly availability, excluding announced maintenance. |
| NFR-04 | Data transparency | Every price and availability record shall display its source update time. Information that cannot be verified shall be labeled as unavailable or unverified. |
| NFR-05 | Calculation accuracy | Displayed totals, discounts, savings, and unit prices shall be calculated to the nearest cent using the product data available at the time of the request. |
| NFR-06 | Security | All personal, account, location, and list data shall be encrypted in transit using TLS and encrypted at rest. |
| NFR-07 | Privacy | Location collection and notifications shall require user consent. Users shall be able to revoke location access, disable notifications, and delete their stored history and lists. |
| NFR-08 | Authorization | Only authenticated and explicitly authorized users shall be able to view or modify a private or shared grocery list. |
| NFR-09 | Accessibility | User-facing web interfaces shall conform to WCAG 2.2 Level AA for supported workflows. |
| NFR-10 | Compatibility | The web application shall support the two latest stable versions of Chrome, Safari, Firefox, and Edge on desktop and mobile screen sizes. |
| NFR-11 | Synchronization | Changes to a shared grocery list shall appear for other connected members within 3 seconds under normal network conditions. |
| NFR-12 | Reliability | If a store-data source is unavailable, the system shall continue to display other available stores and clearly identify the unavailable source instead of returning misleading comparison results. |

## 7. Assumptions and Constraints

- Price Pantry depends on participating stores or approved third-party data providers for product, price, sale, and availability information.
- Displayed prices and inventory are estimates and may change before the user reaches the store.
- Travel estimates depend on the quality and availability of a mapping service.
- Dietary and allergen information is informational and must be shown with its source or verification status; the application must not imply that unverified products are safe.
- The first release is a responsive web application and does not process grocery purchases or provide delivery.

## 8. Traceability Summary

Each of the four team members is the clearly identified main author of three user stories. All 12 stories map to one or more functional requirements, and the non-functional requirements define measurable quality expectations for performance, availability, data transparency, security, privacy, accessibility, compatibility, synchronization, and reliability.
