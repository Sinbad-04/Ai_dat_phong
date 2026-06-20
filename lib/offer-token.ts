import { SignJWT, jwtVerify } from "jose";
import { jwtSecret } from "./env";

export type TrustedOffer = {
  offerId: string;
  hotelId: string;
  name: string;
  roomDescription?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

const secret = () => new TextEncoder().encode(jwtSecret());

export async function createOfferToken(offer: TrustedOffer): Promise<string> {
  return new SignJWT({ offer })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret());
}

export async function verifyOfferToken(token: string): Promise<TrustedOffer | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const offer = payload.offer as TrustedOffer | undefined;
    if (!offer?.offerId || !offer.hotelId || !offer.name || !offer.checkIn || !offer.checkOut) return null;
    return offer;
  } catch {
    return null;
  }
}

