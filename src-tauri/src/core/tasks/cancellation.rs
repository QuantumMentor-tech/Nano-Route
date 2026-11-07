//! Cooperative Cancellation Utilities
//!
//! Exposes and wraps CancellationToken from tokio_util with hierarchical child token support.

pub use tokio_util::sync::CancellationToken;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancellation_hierarchy() {
        let parent = CancellationToken::new();
        let child = parent.child_token();

        assert!(!parent.is_cancelled());
        assert!(!child.is_cancelled());

        parent.cancel();
        assert!(parent.is_cancelled());
        assert!(child.is_cancelled());
    }

    #[test]
    fn test_child_cancellation_isolation() {
        let parent = CancellationToken::new();
        let child = parent.child_token();

        child.cancel();
        assert!(child.is_cancelled());
        assert!(!parent.is_cancelled()); // Child does not cancel parent
    }
}

