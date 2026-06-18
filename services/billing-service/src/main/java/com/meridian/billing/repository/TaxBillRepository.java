package com.meridian.billing.repository;

import com.meridian.billing.domain.TaxBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaxBillRepository extends JpaRepository<TaxBill, String> {

    List<TaxBill> findByCitizenIdOrderByIssuedAtDesc(String citizenId);

    List<TaxBill> findByCitizenIdAndStatusOrderByIssuedAtDesc(String citizenId, String status);

    long countByCitizenId(String citizenId);

    /** Distinct citizens who have any bills — the population for quarterly issuance. */
    @Query("SELECT DISTINCT t.citizenId FROM TaxBill t")
    List<String> findDistinctCitizenIds();

    /** Idempotency guard for quarterly issuance. */
    boolean existsByCitizenIdAndPeriod(String citizenId, String period);
}
