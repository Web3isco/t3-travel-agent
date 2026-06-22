#[derive(serde::Deserialize)]
pub struct BookFlightReq {
    pub offer_id: String,
    pub total_amount: String,
    pub total_currency: String,
}

#[derive(serde::Deserialize)]
pub struct BookHotelReq {
    pub offer_id: String,
    pub total_amount: String,
    pub total_currency: String,
}

#[derive(serde::Serialize)]
pub struct Booking {
    pub id: String,
    pub reference: String,
    pub status: String,
}

const MOCK_API_BASE: &str = "https://api.terminal3.io";

pub fn book_flight(input: &[u8]) -> Result<Vec<u8>, String> {
    let _req: BookFlightReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("book-flight: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let booking = book_flight_wasm(_req)?;
        serde_json::to_vec(&booking).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = _req;
        Err("book_flight is only implemented on wasm32".to_string())
    }
}

pub fn book_hotel(input: &[u8]) -> Result<Vec<u8>, String> {
    let _req: BookHotelReq = serde_json::from_slice(input)
        .map_err(|e| alloc::format!("book-hotel: bad input: {e}"))?;

    #[cfg(target_arch = "wasm32")]
    {
        let booking = book_hotel_wasm(_req)?;
        serde_json::to_vec(&booking).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = _req;
        Err("book_hotel is only implemented on wasm32".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{http_with_placeholders as hwp, kv_store, logging},
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
fn book_flight_wasm(req: BookFlightReq) -> Result<Booking, String> {
    use serde_json::json;

    let api_key = get_api_key()?;

    let order_body = json!({
        "offer_id": req.offer_id,
        "passengers": [{
            "given_name": "{{profile.first_name}}",
            "family_name": "{{profile.last_name}}",
            "email": "{{profile.verified_contacts.email.value}}",
            "phone": "{{profile.verified_contacts.phone.value}}",
        }],
        "payment": {
            "type": "balance",
            "amount": req.total_amount,
            "currency": req.total_currency,
        }
    });

    let _ = logging::info(&alloc::format!("Booking flight offer {}", req.offer_id));

    let resp = hwp::call(&hwp::Request {
        method: hwp::Verb::Post,
        url: alloc::format!("{MOCK_API_BASE}/travel/book-flight"),
        headers: Some(api_headers(&api_key)),
        payload: Some(serde_json::to_vec(&order_body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| alloc::format!("book-flight: {}", format_http_error(e)))?;

    if resp.code != 200 && resp.code != 201 {
        let _ = logging::error(&alloc::format!("book-flight HTTP {}: {}", resp.code,
            alloc::string::String::from_utf8_lossy(&resp.payload)));
        return Err(alloc::format!("book-flight failed: HTTP {}", resp.code));
    }

    let order: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| e.to_string())?;

    let booking_id = order["id"].as_str().ok_or("missing booking id")?.to_string();
    let reference = order["reference"].as_str().unwrap_or("").to_string();
    let status = order["status"].as_str().unwrap_or("confirmed").to_string();

    let _ = logging::info(&alloc::format!("Flight booked: id={booking_id} ref={reference}"));

    Ok(Booking { id: booking_id, reference, status })
}

#[cfg(target_arch = "wasm32")]
fn book_hotel_wasm(req: BookHotelReq) -> Result<Booking, String> {
    use serde_json::json;

    let api_key = get_api_key()?;

    let order_body = json!({
        "offer_id": req.offer_id,
        "guests": [{
            "given_name": "{{profile.first_name}}",
            "family_name": "{{profile.last_name}}",
            "email": "{{profile.verified_contacts.email.value}}",
        }],
        "payment": {
            "type": "balance",
            "amount": req.total_amount,
            "currency": req.total_currency,
        }
    });

    let _ = logging::info(&alloc::format!("Booking hotel offer {}", req.offer_id));

    let resp = hwp::call(&hwp::Request {
        method: hwp::Verb::Post,
        url: alloc::format!("{MOCK_API_BASE}/travel/book-hotel"),
        headers: Some(api_headers(&api_key)),
        payload: Some(serde_json::to_vec(&order_body).map_err(|e| e.to_string())?),
    })
    .map_err(|e| alloc::format!("book-hotel: {}", format_http_error(e)))?;

    if resp.code != 200 && resp.code != 201 {
        return Err(alloc::format!("book-hotel failed: HTTP {}", resp.code));
    }

    let order: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| e.to_string())?;

    let booking_id = order["id"].as_str().ok_or("missing booking id")?.to_string();
    let reference = order["reference"].as_str().unwrap_or("").to_string();
    let status = order["status"].as_str().unwrap_or("confirmed").to_string();

    Ok(Booking { id: booking_id, reference, status })
}

#[cfg(target_arch = "wasm32")]
fn format_http_error(e: hwp::HttpError) -> alloc::string::String {
    match e {
        hwp::HttpError::EgressDenied(host) => alloc::format!("egress denied for host {host}"),
        hwp::HttpError::PlaceholderDenied(marker) => {
            alloc::format!("placeholder not permitted: {marker}")
        }
        hwp::HttpError::PlaceholderUnknown(field) => {
            alloc::format!("user profile missing field: {field}")
        }
        hwp::HttpError::PlaceholderNoUserContext => {
            "no user context bound".to_string()
        }
        hwp::HttpError::UpstreamError(reason) => alloc::format!("upstream: {reason}"),
    }
}

#[cfg(target_arch = "wasm32")]
fn get_api_key() -> Result<alloc::string::String, alloc::string::String> {
    let tid = tenant_context::tenant_did();
    let map_name = alloc::format!("z:{}:secrets", hex::encode(&tid));
    let bytes = kv_store::get(&map_name, b"travel_api_key")
        .map_err(|e| alloc::format!("kv read: {e}"))?
        .ok_or("travel_api_key not found in z:<tid>:secrets")?;
    alloc::string::String::from_utf8(bytes).map_err(|e| e.to_string())
}

#[cfg(target_arch = "wasm32")]
fn api_headers(
    api_key: &str,
) -> alloc::vec::Vec<(alloc::string::String, alloc::string::String)> {
    alloc::vec![
        ("Authorization".to_string(), alloc::format!("Bearer {api_key}")),
        ("Content-Type".to_string(), "application/json".to_string()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn book_flight_non_wasm_returns_err() {
        let input = serde_json::to_vec(&serde_json::json!({
            "offer_id": "fl_123", "total_amount": "299.00", "total_currency": "USD",
        })).unwrap();
        let result = book_flight(&input);
        assert!(result.is_err());
    }

    #[test]
    fn book_flight_bad_input_returns_err() {
        let result = book_flight(b"not json");
        assert!(result.is_err());
    }
}
