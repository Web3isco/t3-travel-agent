import {
  T3nClient,
  getScriptVersion,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import { AgentAuthManager, Mandate } from "./authz.js";

export interface SearchFlightsInput {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers: number;
}

export interface SearchHotelsInput {
  city: string;
  check_in: string;
  check_out: string;
  guests: number;
}

export interface BookingInput {
  offer_id: string;
  total_amount: string;
  total_currency: string;
}

export interface TripPlan {
  flights: Array<{
    id: string;
    airline: string;
    flight_number: string;
    departure_time: string;
    arrival_time: string;
    total_amount: string;
    total_currency: string;
  }>;
  hotels: Array<{
    id: string;
    name: string;
    room_type: string;
    total_amount: string;
    total_currency: string;
  }>;
  total_cost: string;
}

export class TravelBookingAgent {
  private client: T3nClient;
  private agentDid: string;
  private tenantDid: string;
  private scriptName: string;
  private authManager: AgentAuthManager;
  private mandate: Mandate;
  private usedBudget: number = 0;

  constructor(
    client: T3nClient,
    agentDid: string,
    tenantDid: string,
    scriptName: string,
    authManager: AgentAuthManager,
    mandate: Mandate,
  ) {
    this.client = client;
    this.agentDid = agentDid;
    this.tenantDid = tenantDid;
    this.scriptName = scriptName;
    this.authManager = authManager;
    this.mandate = mandate;
  }

  get remainingBudget(): number {
    return this.mandate.spendingLimit - this.usedBudget;
  }

  private checkBudget(amount: number, currency: string): void {
    if (currency !== this.mandate.currency) {
      throw new Error(
        `Currency mismatch: expected ${this.mandate.currency}, got ${currency}`,
      );
    }
    if (amount > this.remainingBudget) {
      throw new Error(
        `Budget exceeded: ${amount} ${currency} remaining ${this.remainingBudget} ${this.mandate.currency}`,
      );
    }
    if (amount > this.mandate.maxBookingAmount) {
      throw new Error(
        `Single booking exceeds max: ${amount} > ${this.mandate.maxBookingAmount}`,
      );
    }
  }

  private checkDestination(destination: string): void {
    if (
      this.mandate.allowedDestinations.length > 0 &&
      !this.mandate.allowedDestinations.includes(destination)
    ) {
      throw new Error(
        `Destination ${destination} not in allowed list: ${this.mandate.allowedDestinations.join(", ")}`,
      );
    }
  }

  async searchFlights(input: SearchFlightsInput): Promise<TripPlan["flights"]> {
    this.checkDestination(input.destination);

    const scriptVersion = await getScriptVersion(getNodeUrl(), this.scriptName);

    const result = await this.client.executeAndDecode({
      script_name: this.scriptName,
      script_version: scriptVersion,
      function_name: "search-flights",
      input,
    });

    return result.offers;
  }

  async searchHotels(input: SearchHotelsInput): Promise<TripPlan["hotels"]> {
    const scriptVersion = await getScriptVersion(getNodeUrl(), this.scriptName);

    const result = await this.client.executeAndDecode({
      script_name: this.scriptName,
      script_version: scriptVersion,
      function_name: "search-hotels",
      input,
    });

    return result.offers;
  }

  async bookFlight(offerId: string, amount: string, currency: string): Promise<Record<string, unknown>> {
    const numAmount = parseFloat(amount);
    this.checkBudget(numAmount, currency);

    const scriptVersion = await getScriptVersion(getNodeUrl(), this.scriptName);

    const result = await this.client.executeAndDecode({
      script_name: this.scriptName,
      script_version: scriptVersion,
      function_name: "book-flight",
      input: {
        offer_id: offerId,
        total_amount: amount,
        total_currency: currency,
      },
    });

    this.usedBudget += numAmount;
    return result;
  }

  async bookHotel(offerId: string, amount: string, currency: string): Promise<Record<string, unknown>> {
    const numAmount = parseFloat(amount);
    this.checkBudget(numAmount, currency);

    const scriptVersion = await getScriptVersion(getNodeUrl(), this.scriptName);

    const result = await this.client.executeAndDecode({
      script_name: this.scriptName,
      script_version: scriptVersion,
      function_name: "book-hotel",
      input: {
        offer_id: offerId,
        total_amount: amount,
        total_currency: currency,
      },
    });

    this.usedBudget += numAmount;
    return result;
  }

  async planTrip(params: {
    origin: string;
    destination: string;
    departure_date: string;
    return_date?: string;
    check_in: string;
    check_out: string;
    passengers: number;
  }): Promise<TripPlan> {
    console.log(`\nPlanning trip from ${params.origin} to ${params.destination}...`);

    const flights = await this.searchFlights({
      origin: params.origin,
      destination: params.destination,
      departure_date: params.departure_date,
      return_date: params.return_date,
      passengers: params.passengers,
    });

    const hotels = await this.searchHotels({
      city: params.destination,
      check_in: params.check_in,
      check_out: params.check_out,
      guests: params.passengers,
    });

    const totalCost = [...flights, ...hotels]
      .reduce((sum, item) => sum + parseFloat(item.total_amount), 0)
      .toFixed(2);

    return {
      flights,
      hotels,
      total_cost: totalCost,
    };
  }

  async bookTrip(params: {
    flightOfferId?: string;
    flightAmount?: string;
    flightCurrency?: string;
    hotelOfferId?: string;
    hotelAmount?: string;
    hotelCurrency?: string;
  }): Promise<{
    flightBooking?: Record<string, unknown>;
    hotelBooking?: Record<string, unknown>;
  }> {
    const bookings: {
      flightBooking?: Record<string, unknown>;
      hotelBooking?: Record<string, unknown>;
    } = {};

    if (params.flightOfferId && params.flightAmount) {
      console.log("\nBooking flight...");
      bookings.flightBooking = await this.bookFlight(
        params.flightOfferId,
        params.flightAmount,
        params.flightCurrency || "USD",
      );
    }

    if (params.hotelOfferId && params.hotelAmount) {
      console.log("\nBooking hotel...");
      bookings.hotelBooking = await this.bookHotel(
        params.hotelOfferId,
        params.hotelAmount,
        params.hotelCurrency || "USD",
      );
    }

    return bookings;
  }
}
