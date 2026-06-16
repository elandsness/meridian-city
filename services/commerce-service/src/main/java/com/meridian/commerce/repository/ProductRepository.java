package com.meridian.commerce.repository;

import com.meridian.commerce.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, String> {

    List<Product> findByActiveTrueOrderByPriceCentsAsc();
}
