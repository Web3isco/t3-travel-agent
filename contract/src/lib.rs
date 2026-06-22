#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
extern crate alloc;

pub const CONTRACT_VERSION: &str = "0.1.0";

wit_bindgen::generate!({
    world: "travel-agent",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod booking;
mod search;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::travel_agent::contracts::Guest for Component {
    fn search_flights(
        req: exports::z::travel_agent::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("search-flights: missing input")?;
        search::search_flights(&input)
    }

    fn search_hotels(
        req: exports::z::travel_agent::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("search-hotels: missing input")?;
        search::search_hotels(&input)
    }

    fn book_flight(
        req: exports::z::travel_agent::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("book-flight: missing input")?;
        booking::book_flight(&input)
    }

    fn book_hotel(
        req: exports::z::travel_agent::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("book-hotel: missing input")?;
        booking::book_hotel(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3);
        for part in parts {
            assert!(part.parse::<u32>().is_ok());
        }
    }
}
