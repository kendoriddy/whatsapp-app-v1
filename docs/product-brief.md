# Relay — product brief

**Audience:** product management  
**Date:** 23 Oct 2026  
**Pilot workspace:** MMABON Desk (MMABON Custom & Retail, Nigerian custom apparel)  
**Public name:** Relay — “The WhatsApp order desk for teams that sell in chat.”

This brief describes what the product is for and how staff are meant to use it. It is not the engineering spec (`spec-v2.md`). A short note at the end says which parts are live in the desk today and which are still the product design or marketing.

---

## One sentence

Relay is a shared desk for a team that already sells on one WhatsApp Business number: every customer chat lands in one inbox, staff turn the chat into an order and a naira invoice, the customer pays with Paystack, and an assistant named Merlin helps people catch up — without sending messages or confirming orders on its own.

## Who it is for

**Buyer of the product.** A Nigerian business whose sales happen in WhatsApp chat, not in a storefront. The first customer is MMABON: custom shirts, polos, logos, sizes, deadlines, deposits.

**People inside the desk.**

| Role       | What they are there to do                                                          |
| ---------- | ---------------------------------------------------------------------------------- |
| Sales      | Own chats, reply, build the order, send the invoice and payment link               |
| Manager    | Same as sales, plus prices, manual payments, and the audit trail                   |
| Admin      | Everything a manager can do, plus WhatsApp numbers, automation, and who has access |
| Designer   | See the chat and the brief; update artwork, placement, and decoration; cannot send |
| Production | See the chat; update fabric; move a paid order into production                     |
| Dispatch   | See the chat; update delivery; mark the order fulfilled                            |

Customers never log in. They keep messaging the business number they already have. After they pay, they land on a simple receipt page.

## The problem

Sales live on one phone. When that person is away, replies stop. Order details (quantity, colour, sizes, logo, deadline, budget) are buried in a long chat. Nobody can see, from one place, who was last replied to, what was quoted, and who has actually paid. Screenshots of bank transfers are the payment record.

Relay replaces that phone with a desk the whole team can work from, on the same number.

## How a sale is supposed to move

1. **The customer messages WhatsApp.** The message appears in the shared inbox within a few seconds, with the sender’s name and a short preview.
2. **The chat is labelled.** Each inbound message is classified as one of: inquiry, order, complaint, or spam, with a confidence score. Sales or a manager can correct the label. Low-confidence labels are meant to sit in an AI review queue.
3. **Someone owns it.** Sales, a manager, or an admin assigns the conversation so two people do not reply at once. Anyone on the team can read the thread.
4. **Staff reply from the desk.** Inside WhatsApp’s 24-hour window (counted from the customer’s last message), they can send normal text and media. After the window closes, only a pre-approved WhatsApp template can go out. Delivery ticks come back from WhatsApp (sent, delivered, read, failed).
5. **The chat becomes an order.** Sales create an order on the conversation. The brief holds what was actually said: who it is for, what they want, quantities and variants, sizes, decoration, deadline, delivery, budget. Each field is marked confirmed, provisional, assumed, or missing, and can point back at the message it came from.
6. **Staff price it and send an invoice.** Prices come from the business’s own price rules, or staff type the amount. The customer receives the invoice in the chat. They can be asked for a deposit (a percent or a fixed amount), the balance, or the full amount.
7. **They pay on Paystack.** When Paystack confirms the payment, the order shows as paid. A bank transfer can be recorded by hand by an admin or manager, with a note. Paying does not, by itself, count as the customer accepting the order.
8. **The work gets done.** After payment, production moves the order into production, then dispatch marks it fulfilled. If the customer goes quiet, the order is marked lost, with a reason.

Times on screen are Lagos time. Money is naira.

## What each part of the desk is for

**Inbox.** The shared list of WhatsApp conversations: who wrote, a preview, unread count, and the latest class (inquiry, order, complaint, spam). Opening a thread shows the full chat, media, and a composer. Sales can send. Other roles submit a draft for someone who is allowed to send.

**Approvals.** The queue of messages that are written but not yet allowed to go to the customer: staff drafts from people who cannot send, AI suggestions, follow-ups, invoices, and payment links. An approver can edit, approve and send, or reject with a reason.

**Orders.** One row per sale, tied to the conversation. Stage runs:

`new enquiry → awaiting details → quoted → negotiating → confirmed → paid → in production → fulfilled`

`lost` can be set from any stage before fulfilled.

Beside the stage, the order also says who it is waiting on: the customer (missing details, or a decision), an internal team, or nobody. A manager looking at the board should be able to read “Quoted · waiting on the customer’s decision” without opening the chat.

**Follow-ups.** A list of chats that need a nudge: details still missing, a quote with no reply, or a balance due before the deadline. Staff can add one by hand. Generated nudges are drafts; they are not sent until someone approves them, unless an admin has explicitly turned that automation on.

**Dashboard.** A manager’s view of the desk: open chats, recent inbound volume, messages waiting for approval, and classifications that still need a human look. The intended fuller view also covers response time, open complaints, orders and naira by stage, quotes waiting on a decision, payments and balances, late orders, and overdue follow-ups.

**AI review.** Messages the classifier was unsure about, so sales or a manager can confirm or change the label. Those corrections are the labelled set used to judge the classifier later.

**Settings.** Admin connects and switches the WhatsApp Business number without a redeploy, sees template status, and turns features and automatic sending on or off. Managers maintain price rules, lead times, and default assumptions.

**Audit.** A filterable history of who changed what: approvals, automation toggles, number switches, payments recorded by hand.

**Merlin.** The in-thread assistant. On a conversation it can summarise the chat (what they want, what is still open, what to do next) and draft an invoice (description, amount, delivery, deposit) for staff to edit before anything is sent.

## Product rules that should not be relaxed

These are product decisions, not implementation details. They are what makes Relay safe to put in front of a paying customer.

**Merlin does not invent the order.** If the customer did not say the fabric, the quantity, the colour split, or the price, that field stays missing. A photo is a reference: it can be described in notes and can prompt a question. It cannot become the product, the colour, or the price. A hedge (“maybe 80”, “mostly L”) stays provisional. “Assumed” is allowed only when the business has turned on an explicit default rule, and the screen says which rule.

**Nothing reaches the customer unless a person sends it.** Clicking Send is the approval, and only sales, managers, and admins can do that. Designers, production, and dispatch can write a message and submit it. Merlin’s drafts, follow-ups, invoices, and payment links start unsent. An admin can turn on a specific automatic send (read receipts, a payment thank-you, an out-of-hours ack, follow-up reminders). Each of those is off by default, requires the admin to type the setting name to confirm, is written to the audit log, and shows a banner on every page while it is on.

**The assistant cannot close the sale.** It cannot mark an order confirmed, paid, or fulfilled. Confirmation needs a staff click and a customer message that counts as acceptance. A payment that arrives before confirmation is flagged for sales (“payment received — confirm the order”). It does not skip that step. “Ok, let me discuss with my team” is not acceptance.

**WhatsApp’s window is visible.** While the customer has written in the last 24 hours, staff can write freely. When that window is closed, the composer explains that only a template can be sent. A draft that sits unapproved until the window closes is cancelled, with a note to use a template.

**Every AI result can be traced.** Each run records which step it was, which model and prompt, what it returned, and whether validation kept or dropped it. Staff can see that a value came from Merlin or from a person.

**A repeated webhook does not double-charge or double-message.** WhatsApp and Paystack can deliver the same event more than once. A message, a delivery status, and a payment are each recorded once.

## What this product is not

- A chatbot that talks to customers by itself.
- The personal WhatsApp app, a linked phone, or an import of old chats. The only source of messages is Meta’s WhatsApp Cloud API.
- Group chats, voice or video calls, or marketing broadcasts.
- A multi-brand SaaS in the current build. The desk is one workspace. The public site talks about plans and “start free”; signup today only records interest. It does not create a new workspace.

## Jobs the pilot must get right

These are the situations MMABON actually hits. They are the acceptance stories for the product.

**Details arrive in pieces.** “Polos for staff.” Later: “maybe 80, navy.” Later: “logo, will send.” Later: “mostly L and XL.” Later: “before the 28th?” The desk should end as one order, with quantity and colour provisional, sizes named but not counted, fabric and delivery missing, and a short list of questions to send back. It should not guess a fabric or split “mostly L and XL” into numbers.

**A picture and a price question.** The customer sends a shirt photo and asks “how much for 50?” That is an inquiry. The picture does not become the product spec. No invoice is created until staff know the product and the decoration. Any range shown to staff is labelled an estimate, not a quote.

**One message, many variants.** “120 reunion shirts. 40 white, 40 black, 40 wine. Men round neck, ladies V-neck. Some nicknames on the back. Budget ₦2m. Event in 3 weeks.” Colour totals are known. The men/women split and the sizes are not, and must not be invented. Budget is known. The event date is provisional; the delivery date is still missing until someone asks.

**They want to think about it.** After a quote, “let me discuss with my team” leaves the order quoted and waiting on the customer. It schedules a follow-up on the next working days (Monday–Saturday, Nigerian public holidays excluded). It does not confirm the order.

**They change the order after a quote.** “Make it 200. Red to wine. Remove the caps. Still by Monday?” Quantity, colour, and the removed line apply, the old quote is superseded, and a new draft total is calculated from the price rules (a higher quantity can move into a cheaper tier). “Still by Monday?” does not change the date; it asks whether that date is still possible. If production days do not fit, the order is marked at risk in plain language (“needs 8 production days; 3 available before Monday”).

## Pricing on the public site

The marketing page lists three plans. They are a commercial sketch. Seat limits and plan enforcement are not in the desk.

| Plan     | Price           | What the page promises                                               |
| -------- | --------------- | -------------------------------------------------------------------- |
| Starter  | ₦15,000 / month | 1 WhatsApp number, up to 2 seats, shared inbox and basic order cards |
| Team     | ₦35,000 / month | 1 number, up to 8 seats, orders, Paystack links, Merlin summaries    |
| Business | Contact us      | Multiple numbers, unlimited seats, priority onboarding               |

## Where the product stands

Use this when scoping the next increment. The public site describes the product we are selling. The desk is the pilot for MMABON.

**In the desk now**

- Sign-in for staff, and a public page that explains Relay and collects a signup (business name, email, WhatsApp). Signup is not stored as an account.
- Shared inbox and a thread a person can reply in.
- Message classification into inquiry, complaint, order, or spam.
- Merlin on a thread: a written summary, and a draft invoice the staff member edits (description, goods amount, delivery, deposit as a percent or a fixed amount, or full payment).
- Orders list and order detail, with stage, what the order is waiting on, invoice total, amount paid, and balance.
- Paystack payment links and a customer receipt after payment. Manual payment recording for admin and manager.
- Dashboard cards: open chats, inbound in the last 7 days, pending approvals, classifications that need review.
- Settings for the WhatsApp number, and an audit log.

**Designed, and not yet a working screen**

- The approvals queue (the page is a placeholder; the rule that unapproved messages are not sent still holds in the send path).
- The follow-ups list (placeholder).
- The AI review queue (placeholder).
- The fuller dashboard (response times, complaints, naira by stage, at-risk orders).
- Kanban for orders, evidence chips on every brief field, and the feasibility warning on the order itself.
- Plan limits from the pricing page. There is one workspace, MMABON Desk.

**Intentionally out of this version**

A customer-facing bot, group chats, calling, broadcast campaigns, and importing history from the WhatsApp phone app.
